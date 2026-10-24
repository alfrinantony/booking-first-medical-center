export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { loadFromBlob } from '@/lib/blob-persistence';
import { SettingsStore } from '@/lib/settings-store';
import { Message, MessageAttachment } from '@/types/inbox';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// Global cache for resolved message attachments across sync requests
const attachmentCache = new Map<string, any>();

async function getMetaCreds() {
    let pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || '';
    let igAccessToken = process.env.META_IG_ACCESS_TOKEN || pageAccessToken;
    let pageId = process.env.META_PAGE_ID || '';
    let igUserId = process.env.META_IG_USER_ID || '';
    let appSecret = process.env.META_APP_SECRET || '';

    try {
        const settings = await SettingsStore.getSettings();
        pageAccessToken = pageAccessToken || settings.messengerAccessToken || '';
        igAccessToken = igAccessToken || settings.messengerAccessToken || '';
        pageId = pageId || settings.metaPageId || '';
        igUserId = igUserId || settings.metaIgUserId || '';
        appSecret = appSecret || settings.metaAppSecret || '';
    } catch (e) {
        console.error('[InboxSync] Error loading settings:', e);
    }

    return { pageAccessToken, igAccessToken, pageId, igUserId, appSecret };
}

let cachedPageToken: { token: string; expires: number } | null = null;
async function getPageAccessToken(pageId: string, baseToken: string, appSecret: string): Promise<string> {
    if (cachedPageToken && cachedPageToken.expires > Date.now()) {
        return cachedPageToken.token;
    }
    try {
        const params: Record<string, string> = { access_token: baseToken, fields: 'access_token' };
        if (appSecret) {
            const crypto = await import('crypto');
            params.appsecret_proof = crypto.createHmac('sha256', appSecret).update(baseToken).digest('hex');
        }
        const url = `${GRAPH_BASE}/${pageId}?${new URLSearchParams(params)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.access_token) {
                cachedPageToken = { token: data.access_token, expires: Date.now() + 3600 * 1000 };
                return data.access_token;
            }
        }
    } catch (e) {
        console.warn('[InboxSync] Could not resolve Page Access Token:', e);
    }
    return baseToken;
}

async function graphFetch(path: string, token: string, extra: Record<string, string> = {}, explicitSecret?: string) {
    const params: Record<string, string> = { access_token: token, ...extra };
    const appSecret = explicitSecret || process.env.META_APP_SECRET;
    if (appSecret) {
        const crypto = await import('crypto');
        params.appsecret_proof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
    }
    const urlParams = new URLSearchParams(params);
    const url = `${GRAPH_BASE}${path}?${urlParams}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

/**
 * GET /api/admin/inbox/sync
 * Lightweight real-time polling endpoint.
 * Returns only new messages received since a timestamp or for active conversation.
 */
export async function GET(req: NextRequest) {
    const url = req.nextUrl;
    const sinceParam = url.searchParams.get('since');
    const activeConvId = url.searchParams.get('activeConversationId') || '';
    const platform = url.searchParams.get('platform') || '';
    const participantId = url.searchParams.get('participantId') || '';
    const graphConvIdParam = url.searchParams.get('graphConversationId') || '';

    const sinceDate = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 30000);
    const sinceMs = sinceDate.getTime();

    const newMessages: Message[] = [];
    const seenIds = new Set<string>();

    try {
        // 1. Check webhook-messages buffer in Azure blob (bypassing cache for freshness)
        const webhookData = await loadFromBlob<{ messages: any[] }>('webhook-messages', { messages: [] }, { bypassCache: true });
        if (webhookData.messages && Array.isArray(webhookData.messages)) {
            for (const wm of webhookData.messages) {
                const msgTime = new Date(wm.timestamp).getTime();
                // Filter messages that occurred after 'since' (with a 2-second grace buffer)
                if (msgTime > (sinceMs - 2000)) {
                    let convId = wm.conversationId;
                    if (!convId) {
                        convId = `${wm.platform}-dm-${wm.senderId === '17841406116856119' ? wm.recipientId : wm.senderId}`;
                    }

                    if (!seenIds.has(wm.id)) {
                        seenIds.add(wm.id);
                        newMessages.push({
                            id: wm.id,
                            conversationId: convId,
                            senderId: wm.senderId,
                            senderName: wm.senderName || 'User',
                            content: wm.message,
                            timestamp: wm.timestamp,
                            platform: wm.platform,
                            isFromStaff: Boolean(wm.senderName === 'Staff Member' || wm.senderId === '17841406116856119'),
                            status: 'read',
                            attachments: wm.attachments || undefined,
                        });
                    }
                }
            }
        }

        // 2. If an active Instagram or Facebook conversation is open, check latest 5 messages from Graph API
        if (activeConvId && (platform === 'instagram' || platform === 'facebook')) {
            const cleanConvId = (graphConvIdParam || activeConvId)
                .replace(/^ig-dm-/, '')
                .replace(/^fb-dm-/, '')
                .replace(/^instagram-dm-/, '')
                .replace(/^facebook-dm-/, '');

            const isGraphConv = cleanConvId.startsWith('bmV3') || cleanConvId.startsWith('t_') || cleanConvId.includes(':') || cleanConvId.startsWith('aWdf');

            if (isGraphConv) {
                const { pageAccessToken, igAccessToken, pageId, igUserId, appSecret } = await getMetaCreds();
                const targetPageId = pageId || '449855885371740';
                const accessToken = await getPageAccessToken(targetPageId, pageAccessToken || igAccessToken, appSecret);

                const msgData = await graphFetch(
                    `/${cleanConvId}/messages`,
                    accessToken,
                    { fields: 'id,message,from,created_time', limit: '5' },
                    appSecret,
                );

                if (msgData?.data && Array.isArray(msgData.data)) {
                    // Check if any message is newer than sinceMs
                    const recentMsgs = msgData.data.filter((m: any) => new Date(m.created_time).getTime() > (sinceMs - 3000));
                    
                    if (recentMsgs.length > 0) {
                        // Resolve attachments for empty messages
                        await Promise.all(
                            recentMsgs.filter((m: any) => !m.message).map(async (m: any) => {
                                if (attachmentCache.has(m.id)) {
                                    m._resolved = attachmentCache.get(m.id);
                                    return;
                                }
                                try {
                                    const details = await graphFetch(
                                        `/${m.id}`,
                                        accessToken,
                                        { fields: 'id,message,attachments{id,image_data,mime_type,name,file_url,video_data},shares,is_unsupported' },
                                        appSecret,
                                    );
                                    if (details) {
                                        attachmentCache.set(m.id, details);
                                        m._resolved = details;
                                    }
                                } catch (e) {
                                    console.warn('[InboxSync] Error resolving attachment:', e);
                                }
                            })
                        );

                        for (const m of recentMsgs) {
                            if (!seenIds.has(m.id)) {
                                seenIds.add(m.id);
                                const isFromUs = m.from?.id === igUserId || m.from?.id === targetPageId || m.from?.username === 'dubaifmc';

                                const attachments: MessageAttachment[] = [];
                                const resolved = m._resolved;
                                if (resolved?.attachments?.data) {
                                    for (const att of resolved.attachments.data) {
                                        if (att.image_data?.url) {
                                            attachments.push({
                                                type: 'image',
                                                url: att.image_data.url,
                                                previewUrl: att.image_data.preview_url || att.image_data.url,
                                                width: att.image_data.width,
                                                height: att.image_data.height,
                                            });
                                        } else if (att.video_data?.url) {
                                            attachments.push({
                                                type: 'video',
                                                url: att.video_data.url,
                                            });
                                        } else if (att.file_url) {
                                            attachments.push({
                                                type: 'file',
                                                url: att.file_url,
                                                name: att.name,
                                            });
                                        }
                                    }
                                }
                                if (resolved?.shares?.data) {
                                    for (const sh of resolved.shares.data) {
                                        if (sh.link) {
                                            attachments.push({
                                                type: 'share',
                                                url: sh.link,
                                            });
                                        }
                                    }
                                }
                                if (resolved?.is_unsupported && attachments.length === 0) {
                                    attachments.push({
                                        type: 'unsupported',
                                        text: 'Shared Instagram Reel / Story / Post',
                                    });
                                }

                                let content = m.message || '';
                                if (!content && attachments.length > 0) {
                                    if (attachments.some(a => a.type === 'image')) content = '📷 Photo';
                                    else if (attachments.some(a => a.type === 'share')) content = '🎬 Shared Reel / Post';
                                    else content = '📎 Attachment';
                                }

                                newMessages.push({
                                    id: m.id,
                                    conversationId: activeConvId,
                                    senderId: m.from?.id || '',
                                    senderName: m.from?.username || m.from?.name || (isFromUs ? 'First Medical Center' : 'User'),
                                    content,
                                    timestamp: m.created_time || new Date().toISOString(),
                                    platform: platform as any,
                                    isFromStaff: isFromUs,
                                    status: 'read',
                                    attachments: attachments.length > 0 ? attachments : undefined,
                                });
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('[InboxSync] Error during sync:', err);
    }

    return NextResponse.json({
        newMessages,
        timestamp: new Date().toISOString(),
    });
}
