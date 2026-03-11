import { NextRequest, NextResponse } from 'next/server';
import { SettingsStore } from '@/lib/settings-store';

// ─────────────────────────────────────────────────────────────
// Meta DMs API — Fetches Facebook Messenger & Instagram DMs
// via the Meta Graph API (v19.0)
// ─────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Resolve Meta credentials: process.env first, then settings store.
 */
async function getMetaCreds() {
    let pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || '';
    let pageId = process.env.META_PAGE_ID || '';
    let igUserId = process.env.META_IG_USER_ID || '';

    if (!pageAccessToken || !pageId) {
        try {
            const settings = await SettingsStore.getSettings();
            pageAccessToken = pageAccessToken || settings.messengerAccessToken || '';
            pageId = pageId || settings.metaPageId || '';
            igUserId = igUserId || settings.metaIgUserId || '';
        } catch (e) {
            console.error('[MetaDMs] Could not load settings:', e);
        }
    }

    return { pageAccessToken, pageId, igUserId };
}

async function graphFetch(path: string, token: string, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ access_token: token, ...extra });
    const url = `${GRAPH_BASE}${path}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errText = await res.text();
        console.error(`[MetaDMs] Graph API ${path}: ${res.status} — ${errText}`);
        return null;
    }
    return res.json();
}

interface DMConversation {
    id: string;
    platform: 'facebook' | 'instagram';
    messageType: 'dm';
    participantName: string;
    participantAvatar?: string;
    participantId: string;
    lastMessageContent: string;
    lastMessageTimestamp: string;
    unreadCount: number;
    messages: DMMessage[];
}

interface DMMessage {
    id: string;
    from: string;
    fromName: string;
    message: string;
    timestamp: string;
    isFromPage: boolean;
}

/**
 * GET /api/admin/meta-dms
 * Fetches Facebook Messenger and Instagram DM conversations.
 */
export async function GET() {
    const { pageAccessToken, pageId, igUserId } = await getMetaCreds();

    if (!pageAccessToken || !pageId) {
        return NextResponse.json(
            {
                error: 'Meta credentials not configured.',
                help: 'Go to Settings → Communication → Meta/Facebook and enter your Page ID and Messenger Access Token.',
            },
            { status: 500 },
        );
    }

    const conversations: DMConversation[] = [];

    // ── 1. Facebook Messenger Conversations ──
    try {
        const fbConvos = await graphFetch(
            `/${pageId}/conversations`,
            pageAccessToken,
            { fields: 'participants,updated_time,unread_count,snippet', limit: '25' },
        );

        if (fbConvos?.data) {
            for (let i = 0; i < fbConvos.data.length; i++) {
                const convo = fbConvos.data[i];
                const convId = `fb-dm-${convo.id || i}`;

                // Get participant (the customer, not the page)
                let participantName = 'Facebook User';
                let participantId = '';
                if (convo.participants?.data) {
                    const customer = convo.participants.data.find(
                        (p: any) => p.id !== pageId,
                    );
                    if (customer) {
                        participantName = customer.name || 'Facebook User';
                        participantId = customer.id || '';
                    }
                }

                // Fetch messages for this conversation
                const msgs: DMMessage[] = [];
                try {
                    const msgData = await graphFetch(
                        `/${convo.id}/messages`,
                        pageAccessToken,
                        { fields: 'message,from,created_time', limit: '20' },
                    );
                    if (msgData?.data) {
                        for (const m of msgData.data) {
                            msgs.push({
                                id: m.id,
                                from: m.from?.id || '',
                                fromName: m.from?.name || 'Unknown',
                                message: m.message || '',
                                timestamp: m.created_time || new Date().toISOString(),
                                isFromPage: m.from?.id === pageId,
                            });
                        }
                        // Reverse so oldest first
                        msgs.reverse();
                    }
                } catch (err) {
                    console.error(`[MetaDMs] Error fetching FB messages for ${convo.id}:`, err);
                }

                const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

                conversations.push({
                    id: convId,
                    platform: 'facebook',
                    messageType: 'dm',
                    participantName,
                    participantId,
                    lastMessageContent: latestMsg?.message || convo.snippet || '',
                    lastMessageTimestamp: convo.updated_time || new Date().toISOString(),
                    unreadCount: convo.unread_count || 0,
                    messages: msgs,
                });
            }
        }
    } catch (err) {
        console.error('[MetaDMs] Facebook conversations error:', err);
    }

    // ── 2. Instagram DM Conversations ──
    if (igUserId) {
        try {
            const igConvos = await graphFetch(
                `/${igUserId}/conversations`,
                pageAccessToken,
                { platform: 'instagram', fields: 'participants,updated_time,name', limit: '25' },
            );

            if (igConvos?.data) {
                for (let i = 0; i < igConvos.data.length; i++) {
                    const convo = igConvos.data[i];
                    const convId = `ig-dm-${convo.id || i}`;

                    let participantName = 'Instagram User';
                    let participantId = '';
                    if (convo.participants?.data) {
                        const customer = convo.participants.data.find(
                            (p: any) => p.id !== igUserId,
                        );
                        if (customer) {
                            participantName = customer.username || customer.name || 'Instagram User';
                            participantId = customer.id || '';
                        }
                    }

                    // Fetch messages
                    const msgs: DMMessage[] = [];
                    try {
                        const msgData = await graphFetch(
                            `/${convo.id}/messages`,
                            pageAccessToken,
                            { fields: 'message,from,created_time', limit: '20' },
                        );
                        if (msgData?.data) {
                            for (const m of msgData.data) {
                                msgs.push({
                                    id: m.id,
                                    from: m.from?.id || '',
                                    fromName: m.from?.name || m.from?.username || 'Unknown',
                                    message: m.message || '',
                                    timestamp: m.created_time || new Date().toISOString(),
                                    isFromPage: m.from?.id === igUserId,
                                });
                            }
                            msgs.reverse();
                        }
                    } catch (err) {
                        console.error(`[MetaDMs] Error fetching IG messages for ${convo.id}:`, err);
                    }

                    const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

                    conversations.push({
                        id: convId,
                        platform: 'instagram',
                        messageType: 'dm',
                        participantName,
                        participantId,
                        lastMessageContent: latestMsg?.message || convo.name || '',
                        lastMessageTimestamp: convo.updated_time || new Date().toISOString(),
                        unreadCount: 0,
                        messages: msgs,
                    });
                }
            }
        } catch (err) {
            console.error('[MetaDMs] Instagram conversations error:', err);
        }
    }

    // Sort by most recent
    conversations.sort(
        (a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime(),
    );

    return NextResponse.json({ conversations });
}

/**
 * POST /api/admin/meta-dms
 * Body: { platform, recipientId, content }
 * Send a reply to a Facebook Messenger or Instagram DM.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, recipientId, content } = body;

        if (!content || !recipientId) {
            return NextResponse.json({ error: 'content and recipientId are required' }, { status: 400 });
        }

        const { pageAccessToken, pageId, igUserId } = await getMetaCreds();
        if (!pageAccessToken) {
            return NextResponse.json({ error: 'Meta credentials not configured' }, { status: 500 });
        }

        let sent = false;
        let errorDetail = '';
        const senderId = platform === 'instagram' ? igUserId : pageId;
        const sendUrl = `${GRAPH_BASE}/${senderId}/messages?access_token=${pageAccessToken}`;

        try {
            // ── Attempt 1: Standard RESPONSE (works within 24h window) ──
            const responsePayload = {
                recipient: { id: recipientId },
                message: { text: content },
                messaging_type: 'RESPONSE',
            };

            const res1 = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responsePayload),
            });

            if (res1.ok) {
                sent = true;
            } else {
                const err1 = await res1.json().catch(() => ({}));
                const errCode = err1?.error?.error_subcode;
                console.error(`[MetaDMs] RESPONSE attempt failed (${platform}):`, JSON.stringify(err1));

                // Error 2018278 = outside the allowed messaging window
                if (platform === 'facebook' && (errCode === 2018278 || err1?.error?.code === 10)) {
                    // ── Attempt 2: HUMAN_AGENT tag (7-day window, requires Meta approval) ──
                    const tagPayload = {
                        recipient: { id: recipientId },
                        message: { text: content },
                        messaging_type: 'MESSAGE_TAG',
                        tag: 'HUMAN_AGENT',
                    };

                    const res2 = await fetch(sendUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(tagPayload),
                    });

                    if (res2.ok) {
                        sent = true;
                    } else {
                        const err2 = await res2.json().catch(() => ({}));
                        console.error(`[MetaDMs] HUMAN_AGENT attempt failed:`, JSON.stringify(err2));

                        // Provide clear user-facing message
                        if (err2?.error?.error_subcode === 2018276) {
                            errorDetail = 'Cannot reply — the 24-hour messaging window has expired. The HUMAN_AGENT permission is pending Meta approval.';
                        } else {
                            errorDetail = err2?.error?.message || 'Message could not be delivered.';
                        }
                    }
                } else {
                    errorDetail = err1?.error?.message || 'Message could not be delivered.';
                }
            }
        } catch (err) {
            console.error(`[MetaDMs] Send error (${platform}):`, err);
            errorDetail = 'Network error while sending message.';
        }

        return NextResponse.json({
            success: sent,
            sent,
            message: sent ? 'DM sent successfully' : (errorDetail || 'Could not send DM'),
        });
    } catch (error) {
        console.error('[MetaDMs] POST error:', error);
        return NextResponse.json({ error: 'Failed to send DM' }, { status: 500 });
    }
}
