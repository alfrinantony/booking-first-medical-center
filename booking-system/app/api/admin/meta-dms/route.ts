export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SettingsStore } from '@/lib/settings-store';
import { loadFromBlob, saveToBlob } from '@/lib/blob-persistence';

interface StoredWebhookMessage {
    id: string;
    senderId: string;
    senderName?: string;
    recipientId: string;
    message: string;
    timestamp: string;
    platform: 'facebook' | 'instagram' | 'whatsapp';
    read: boolean;
}

// ─────────────────────────────────────────────────────────────
// Meta DMs API — Fetches Facebook Messenger & Instagram DMs
// via the Meta Graph API (v21.0)
// ─────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Resolve Meta credentials: process.env first, then settings store.
 */
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
        console.error('[MetaDMs] Could not load settings:', e);
    }

    return { pageAccessToken, igAccessToken, pageId, igUserId, appSecret };
}

let cachedPageToken: { token: string; expires: number } | null = null;

/**
 * For Facebook Page endpoints that require a Page Access Token (error 190):
 * If the current token is a System User token, dynamically request the Page Access Token.
 */
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
        console.warn('[MetaDMs] Could not resolve Page Access Token from base token:', e);
    }
    return baseToken;
}

async function graphFetch(path: string, token: string, extra: Record<string, string> = {}, explicitSecret?: string) {
    const params: Record<string, string> = { access_token: token, ...extra };
    let appSecret = explicitSecret || process.env.META_APP_SECRET;
    if (!appSecret) {
        try {
            const settings = await SettingsStore.getSettings();
            appSecret = settings.metaAppSecret || '';
        } catch {}
    }
    if (appSecret) {
        const crypto = await import('crypto');
        params.appsecret_proof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
    }
    const urlParams = new URLSearchParams(params);
    const url = `${GRAPH_BASE}${path}?${urlParams}`;
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
    platform: 'facebook' | 'instagram' | 'whatsapp';
    messageType: 'dm';
    participantName: string;
    participantAvatar?: string;
    participantId: string;
    graphConversationId?: string;  // original Graph API conversation ID for lazy message loading
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
    isFromStaff?: boolean;
}

/**
 * GET /api/admin/meta-dms
 * Without query params: returns conversation list (including pre-loaded recent messages).
 * With ?conversationId=xxx&platform=xxx: returns full messages for one conversation (lazy load).
 */
export async function GET(request: NextRequest) {
    const { pageAccessToken, igAccessToken, pageId, igUserId, appSecret } = await getMetaCreds();

    if (!pageAccessToken || (!pageId && !igUserId)) {
        return NextResponse.json(
            {
                error: 'Meta credentials not configured.',
                help: 'Go to Settings → Communication → Meta/Facebook and enter your Page ID and Messenger Access Token.',
            },
            { status: 500 },
        );
    }

    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    // ── Lazy-load messages for a single conversation ──
    if (conversationId) {
        const platform = (url.searchParams.get('platform') as 'facebook' | 'instagram' | 'whatsapp') || 'facebook';
        const participantIdParam = url.searchParams.get('participantId') || '';
        const ownerId = platform === 'instagram' ? igUserId : pageId;

        // WhatsApp specific message history resolution
        if (platform === 'whatsapp') {
            const cleanId = conversationId.replace('whatsapp-dm-', '');
            const messages: DMMessage[] = [];
            try {
                // 1. Load from wa-sessions
                const waSessions = await loadFromBlob<{ sessions: Record<string, any> }>('wa-sessions', { sessions: {} });
                const session = waSessions.sessions[cleanId] || waSessions.sessions[conversationId];
                if (session?.history) {
                    session.history.forEach((h: any, idx: number) => {
                        messages.push({
                            id: `wa-hist-${cleanId}-${idx}`,
                            from: h.role === 'assistant' ? (process.env.META_WA_PHONE_NUMBER_ID || 'fmc-clinic') : cleanId,
                            fromName: h.role === 'assistant' ? 'Sofia (AI Agent)' : (session.senderName || 'WhatsApp User'),
                            message: h.content,
                            timestamp: h.timestamp || new Date().toISOString(),
                            isFromPage: h.role === 'assistant',
                        });
                    });
                }

                // 2. Merge from webhook-messages buffer
                const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
                const relevantWebhooks = webhookData.messages.filter(m =>
                    (m.senderId === cleanId || m.recipientId === cleanId || m.senderId === conversationId || m.recipientId === conversationId) && m.platform === 'whatsapp'
                );
                for (const wm of relevantWebhooks) {
                    const exists = messages.some(m => m.id === wm.id || (m.message === wm.message && Math.abs(new Date(m.timestamp).getTime() - new Date(wm.timestamp).getTime()) < 4000));
                    if (!exists) {
                        messages.push({
                            id: wm.id,
                            from: wm.senderId,
                            fromName: wm.senderName || (wm.senderId === cleanId ? 'WhatsApp User' : 'Staff'),
                            message: wm.message,
                            timestamp: wm.timestamp,
                            isFromPage: wm.senderId !== cleanId,
                        });
                    }
                }
                messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            } catch (wErr) {
                console.error('[MetaDMs] WhatsApp messages load error:', wErr);
            }
            return NextResponse.json({ messages });
        }

        // Instagram or Facebook lazy load
        try {
            const accessToken = platform === 'instagram'
                ? igAccessToken
                : await getPageAccessToken(pageId, pageAccessToken, appSecret);

            const messages: DMMessage[] = [];

            // Strip any platform prefixes if present (e.g., "ig-dm-bmV3...", "fb-dm-t_...")
            const cleanConvId = conversationId
                .replace(/^ig-dm-/, '')
                .replace(/^fb-dm-/, '')
                .replace(/^instagram-dm-/, '')
                .replace(/^facebook-dm-/, '');

            // If cleanConvId is a Graph API thread ID
            const isGraphConv = cleanConvId.startsWith('bmV3') || cleanConvId.startsWith('t_') || cleanConvId.includes(':');
            if (isGraphConv) {
                const msgData = await graphFetch(
                    `/${cleanConvId}/messages`,
                    accessToken,
                    { fields: 'id,message,from,created_time', limit: '50' },
                    appSecret,
                );
                if (msgData?.data) {
                    for (const m of msgData.data) {
                        messages.push({
                            id: m.id,
                            from: m.from?.id || '',
                            fromName: m.from?.username || m.from?.name || (m.from?.id === ownerId ? 'First Medical Center' : 'User'),
                            message: m.message || '',
                            timestamp: m.created_time || new Date().toISOString(),
                            isFromPage: m.from?.id === ownerId,
                            isFromStaff: m.from?.id === ownerId,
                        });
                    }
                    messages.reverse(); // oldest first
                }
            }

            // Also check ig-sessions if platform === 'instagram'
            if (platform === 'instagram') {
                try {
                    const igSessions = await loadFromBlob<{ sessions: Record<string, any> }>('ig-sessions', { sessions: {} });
                    const targetId = participantIdParam || conversationId.replace('instagram-dm-', '').replace('ig-dm-', '');
                    const sess = igSessions.sessions[targetId] || igSessions.sessions[conversationId];
                    if (sess?.history) {
                        for (const [idx, h] of sess.history.entries()) {
                            const exists = messages.some(m => m.message === h.content && Math.abs(new Date(m.timestamp).getTime() - new Date(h.timestamp).getTime()) < 10000);
                            if (!exists) {
                                messages.push({
                                    id: `ig-sess-${targetId}-${idx}`,
                                    from: h.role === 'assistant' ? igUserId : targetId,
                                    fromName: h.role === 'assistant' ? 'Sofia (AI Agent)' : (sess.senderName || 'Instagram User'),
                                    message: h.content,
                                    timestamp: h.timestamp || new Date().toISOString(),
                                    isFromPage: h.role === 'assistant',
                                });
                            }
                        }
                    }
                } catch (sErr) {
                    console.warn('[MetaDMs] ig-sessions load error:', sErr);
                }
            }

            // Also merge from webhook buffer to ensure latest messages/staff replies are present
            try {
                const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
                const targetId = participantIdParam || conversationId.replace('instagram-dm-', '').replace('ig-dm-', '').replace('fb-dm-', '');
                const relevantWebhooks = webhookData.messages.filter(m => 
                    (m.senderId === conversationId || m.recipientId === conversationId || (targetId && (m.senderId === targetId || m.recipientId === targetId))) && m.platform === platform
                );
                for (const wm of relevantWebhooks) {
                    const exists = messages.some(m => m.id === wm.id || (m.message === wm.message && Math.abs(new Date(m.timestamp).getTime() - new Date(wm.timestamp).getTime()) < 5000));
                    if (!exists) {
                        messages.push({
                            id: wm.id,
                            from: wm.senderId,
                            fromName: wm.senderName || (wm.senderId === ownerId ? 'Staff' : 'User'),
                            message: wm.message,
                            timestamp: wm.timestamp,
                            isFromPage: wm.senderId === ownerId || wm.senderId === pageId || wm.senderId === igUserId,
                        });
                    }
                }
            } catch (wErr) {
                console.error(`[MetaDMs] Webhook load error for messages:`, wErr);
            }

            messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return NextResponse.json({ messages });
        } catch (err) {
            console.error(`[MetaDMs] Error fetching messages for ${conversationId}:`, err);
            return NextResponse.json({ messages: [] });
        }
    }

    const conversations: DMConversation[] = [];
    let fbNextCursor = '';
    let igNextCursor = '';

    // Accept pagination cursors from query params
    const fbCursor = url.searchParams.get('fbCursor') || '';
    const igCursor = url.searchParams.get('igCursor') || '';

    // ── 1. Instagram DM Conversations via /{igUserId}/conversations ──
    if (igUserId && igAccessToken) {
        try {
            const igParams: Record<string, string> = {
                fields: 'id,updated_time,participants,messages.limit(5){id,message,created_time,from}',
                limit: '25',
            };
            if (igCursor) igParams.after = igCursor;

            const igConvos = await graphFetch(
                `/${igUserId}/conversations`,
                igAccessToken,
                igParams,
                appSecret,
            );

            if (igConvos?.paging?.cursors?.after && igConvos?.paging?.next) {
                igNextCursor = igConvos.paging.cursors.after;
            }

            if (igConvos?.data) {
                for (let i = 0; i < igConvos.data.length; i++) {
                    const convo = igConvos.data[i];

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

                    const lastMsgObj = convo.messages?.data?.[0];
                    const lastMessageContent = lastMsgObj?.message || 'Instagram Message';
                    const lastMessageTimestamp = lastMsgObj?.created_time || convo.updated_time || new Date().toISOString();

                    const initialMessages: DMMessage[] = (convo.messages?.data || []).map((m: any) => ({
                        id: m.id,
                        from: m.from?.id || '',
                        fromName: m.from?.username || m.from?.name || (m.from?.id === igUserId ? 'First Medical Center' : participantName),
                        message: m.message || '',
                        timestamp: m.created_time || new Date().toISOString(),
                        isFromPage: m.from?.id === igUserId,
                        isFromStaff: m.from?.id === igUserId,
                    })).reverse();

                    conversations.push({
                        id: `ig-dm-${convo.id || i}`,
                        platform: 'instagram',
                        messageType: 'dm',
                        participantName,
                        participantId,
                        graphConversationId: convo.id,
                        lastMessageContent,
                        lastMessageTimestamp,
                        unreadCount: 0,
                        messages: initialMessages,
                    });
                }
            }
        } catch (err) {
            console.error('[MetaDMs] Instagram conversations error:', err);
        }
    }

    // ── 2. Facebook Messenger Conversations via /{pageId}/conversations ──
    if (pageId && pageAccessToken) {
        try {
            const pageToken = await getPageAccessToken(pageId, pageAccessToken, appSecret);
            const fbParams: Record<string, string> = {
                fields: 'participants,updated_time,unread_count,snippet',
                limit: '25',
            };
            if (fbCursor) fbParams.after = fbCursor;

            const fbConvos = await graphFetch(
                `/${pageId}/conversations`,
                pageToken,
                fbParams,
                appSecret,
            );

            if (fbConvos?.paging?.cursors?.after && fbConvos?.paging?.next) {
                fbNextCursor = fbConvos.paging.cursors.after;
            }

            if (fbConvos?.data) {
                for (let i = 0; i < fbConvos.data.length; i++) {
                    const convo = fbConvos.data[i];

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

                    conversations.push({
                        id: `fb-dm-${convo.id || i}`,
                        platform: 'facebook',
                        messageType: 'dm',
                        participantName,
                        participantId,
                        graphConversationId: convo.id,
                        lastMessageContent: convo.snippet || '',
                        lastMessageTimestamp: convo.updated_time || new Date().toISOString(),
                        unreadCount: convo.unread_count || 0,
                        messages: [],
                    });
                }
            }
        } catch (err) {
            console.error('[MetaDMs] Facebook conversations error:', err);
        }
    }

    // ── 3. Merge Webhook Messages & WhatsApp / IG Sessions ──
    try {
        const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
        
        for (const msg of webhookData.messages) {
            if (msg.platform !== 'instagram' && msg.platform !== 'facebook' && msg.platform !== 'whatsapp') continue;
            
            const isClinicSender = 
                (msg.platform === 'instagram' && msg.senderId === igUserId) || 
                (msg.platform === 'facebook' && msg.senderId === pageId) ||
                (msg.platform === 'whatsapp' && msg.senderId === process.env.META_WA_PHONE_NUMBER_ID);
            
            const customerId = isClinicSender ? msg.recipientId : msg.senderId;
            
            let existingConvo = conversations.find(c => c.participantId === customerId);
            if (!existingConvo) {
                let pName = msg.senderName || 'User';
                if (!msg.senderName) {
                    if (msg.platform === 'instagram') pName = 'Instagram User';
                    else if (msg.platform === 'facebook') pName = 'Facebook User';
                    else if (msg.platform === 'whatsapp') pName = 'WhatsApp User';
                }

                existingConvo = {
                    id: `${msg.platform}-dm-${customerId}`,
                    platform: msg.platform,
                    messageType: 'dm',
                    participantName: pName,
                    participantId: customerId,
                    graphConversationId: customerId,
                    lastMessageContent: msg.message,
                    lastMessageTimestamp: msg.timestamp,
                    unreadCount: msg.read ? 0 : 1,
                    messages: []
                };
                if (msg.platform === 'whatsapp') {
                    (existingConvo as any).waPhoneNumberId = msg.recipientId; 
                }
                conversations.push(existingConvo);
            } else {
                if (new Date(msg.timestamp).getTime() > new Date(existingConvo.lastMessageTimestamp).getTime()) {
                    existingConvo.lastMessageContent = msg.message;
                    existingConvo.lastMessageTimestamp = msg.timestamp;
                }
                if (msg.senderName && existingConvo.participantName.includes('User')) {
                    existingConvo.participantName = msg.senderName;
                }
            }
        }

        // WhatsApp sessions check
        try {
            const waSessions = await loadFromBlob<{ sessions: Record<string, any> }>('wa-sessions', { sessions: {} });
            for (const [phone, sess] of Object.entries(waSessions.sessions || {})) {
                const cleanPhone = phone.replace('whatsapp-dm-', '');
                if (!conversations.some(c => c.participantId === cleanPhone && c.platform === 'whatsapp')) {
                    const lastMsg = sess.history?.[sess.history.length - 1];
                    conversations.push({
                        id: `whatsapp-dm-${cleanPhone}`,
                        platform: 'whatsapp',
                        messageType: 'dm',
                        participantName: sess.senderName || `WhatsApp (+${cleanPhone})`,
                        participantId: cleanPhone,
                        graphConversationId: cleanPhone,
                        lastMessageContent: lastMsg?.content || 'Appointment chat',
                        lastMessageTimestamp: lastMsg?.timestamp || new Date().toISOString(),
                        unreadCount: 0,
                        messages: [],
                    });
                }
            }
        } catch (sessErr) {
            console.warn('[MetaDMs] wa-sessions check error:', sessErr);
        }

        // Instagram sessions check
        try {
            const igSessions = await loadFromBlob<{ sessions: Record<string, any> }>('ig-sessions', { sessions: {} });
            for (const [senderId, sess] of Object.entries(igSessions.sessions || {})) {
                const cleanSenderId = senderId.replace('ig-dm-', '');
                if (!conversations.some(c => c.participantId === cleanSenderId && c.platform === 'instagram')) {
                    const lastMsg = sess.history?.[sess.history.length - 1];
                    conversations.push({
                        id: `ig-dm-${cleanSenderId}`,
                        platform: 'instagram',
                        messageType: 'dm',
                        participantName: sess.senderName || `Instagram User (${cleanSenderId})`,
                        participantId: cleanSenderId,
                        graphConversationId: cleanSenderId,
                        lastMessageContent: lastMsg?.content || 'Instagram chat',
                        lastMessageTimestamp: lastMsg?.timestamp || new Date().toISOString(),
                        unreadCount: 0,
                        messages: [],
                    });
                }
            }
        } catch (sessErr) {
            console.warn('[MetaDMs] ig-sessions check error:', sessErr);
        }
    } catch (err) {
        console.error('[MetaDMs] Webhook integration error:', err);
    }

    // Sort all by most recent
    conversations.sort(
        (a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime(),
    );

    return NextResponse.json({
        conversations,
        fbNextCursor: fbNextCursor || null,
        igNextCursor: igNextCursor || null,
    });
}

/**
 * POST /api/admin/meta-dms
 * Body: { platform, recipientId, content }
 * Send a reply to an Instagram DM, Facebook Messenger, or WhatsApp.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { platform, recipientId, content } = body;

        if (!content || !recipientId) {
            return NextResponse.json({ error: 'content and recipientId are required' }, { status: 400 });
        }

        const { pageAccessToken, igAccessToken, pageId, igUserId, appSecret } = await getMetaCreds();

        // ── 1. WhatsApp Reply ──
        if (platform === 'whatsapp') {
            const { sendWhatsAppMessage } = await import('@/lib/whatsapp-bot');
            const { SettingsStore } = await import('@/lib/settings-store');
            const settings = await SettingsStore.getSettings();
            
            let waPhoneNumberId = body.waPhoneNumberId || settings.metaPhoneId || process.env.META_WA_PHONE_NUMBER_ID;
            if (!waPhoneNumberId) {
                const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
                const match = webhookData.messages.find(m => (m.senderId === recipientId || m.recipientId === recipientId) && m.platform === 'whatsapp');
                waPhoneNumberId = match?.recipientId || '';
            }

            await sendWhatsAppMessage(recipientId, waPhoneNumberId, content);

            const now = new Date().toISOString();
            try {
                const waSessions = await loadFromBlob<{ sessions: Record<string, any> }>('wa-sessions', { sessions: {} });
                let sess = waSessions.sessions[recipientId];
                if (!sess) sess = { senderPhone: recipientId, history: [] };
                sess.history.push({ role: 'assistant', content, timestamp: now });
                waSessions.sessions[recipientId] = sess;
                await saveToBlob('wa-sessions', waSessions);

                const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
                webhookData.messages.push({
                    id: `wa-staff-${Date.now()}`,
                    senderId: waPhoneNumberId || 'fmc-clinic',
                    senderName: 'Staff Member',
                    recipientId,
                    message: content,
                    timestamp: now,
                    platform: 'whatsapp',
                    read: true,
                });
                if (webhookData.messages.length > 500) webhookData.messages = webhookData.messages.slice(-500);
                await saveToBlob('webhook-messages', webhookData);
            } catch (sErr) {
                console.warn('[MetaDMs] Staff WhatsApp message history save error:', sErr);
            }

            return NextResponse.json({ success: true, sent: true, message: 'WhatsApp message sent' });
        }

        if (!pageAccessToken && !igAccessToken) {
            return NextResponse.json({ error: 'Meta credentials not configured' }, { status: 500 });
        }

        const isInstagram = platform === 'instagram';
        const senderId = isInstagram ? igUserId : (pageId || 'me');
        const tokenToUse = isInstagram
            ? igAccessToken
            : await getPageAccessToken(pageId, pageAccessToken, appSecret);

        let sendUrl = `${GRAPH_BASE}/${senderId}/messages?access_token=${tokenToUse}`;
        if (appSecret && tokenToUse) {
            const crypto = await import('crypto');
            const proof = crypto.createHmac('sha256', appSecret).update(tokenToUse).digest('hex');
            sendUrl += `&appsecret_proof=${proof}`;
        }

        let sent = false;
        let errorDetail = '';

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

                // If outside the 24-hour messaging window, attempt HUMAN_AGENT tag
                if ((platform === 'facebook' || platform === 'instagram') && (errCode === 2018278 || err1?.error?.code === 10)) {
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

            // Persist the staff reply on success
            if (sent) {
                const now = new Date().toISOString();
                try {
                    if (isInstagram) {
                        const igSessions = await loadFromBlob<{ sessions: Record<string, any> }>('ig-sessions', { sessions: {} });
                        let sess = igSessions.sessions[recipientId];
                        if (!sess) sess = { senderId: recipientId, history: [] };
                        sess.history = sess.history || [];
                        sess.history.push({ role: 'assistant', content, timestamp: now });
                        igSessions.sessions[recipientId] = sess;
                        await saveToBlob('ig-sessions', igSessions);
                    }

                    const webhookData = await loadFromBlob<{ messages: StoredWebhookMessage[] }>('webhook-messages', { messages: [] });
                    webhookData.messages.push({
                        id: `${platform}-staff-${Date.now()}`,
                        senderId: senderId,
                        senderName: 'Staff Member',
                        recipientId,
                        message: content,
                        timestamp: now,
                        platform: platform,
                        read: true,
                    });
                    if (webhookData.messages.length > 500) webhookData.messages = webhookData.messages.slice(-500);
                    await saveToBlob('webhook-messages', webhookData);
                } catch (sErr) {
                    console.warn(`[MetaDMs] Staff ${platform} message history save error:`, sErr);
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
