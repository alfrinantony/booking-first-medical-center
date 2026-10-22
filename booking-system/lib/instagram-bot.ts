import { loadFromBlob, saveToBlob } from './blob-persistence';
import { generateAgentReply } from './booking-agent';

// ─────────────────────────────────────────────────────────────
// Instagram DM Bot — Handles incoming Instagram DMs
// Auto-replies using the unified Booking Agent (Sofia).
// Completes bookings directly and syncs with Unified Inbox.
// ─────────────────────────────────────────────────────────────

export interface IgSession {
    senderId: string;
    senderName?: string;
    history: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
    confirmedBookings?: any[];
}

export async function processInstagramMessage(senderId: string, message: string, senderName?: string) {
    try {
        console.log(`[IgBot] Processing message from ${senderId}: ${message}`);

        // 1. Load Session History
        const sessionsData = await loadFromBlob<{ sessions: Record<string, IgSession> }>('ig-sessions', { sessions: {} });

        let session = sessionsData.sessions[senderId];
        if (!session) {
            session = { senderId, senderName, history: [], confirmedBookings: [] };
        } else if (senderName && !session.senderName) {
            session.senderName = senderName;
        }

        // Add user message
        session.history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

        // Keep last 12 messages for context window
        if (session.history.length > 12) {
            session.history = session.history.slice(-12);
        }

        // 2. Generate reply and handle booking via unified booking agent
        const { text: aiResponseText, confirmedBooking } = await generateAgentReply(
            'instagram',
            session.history.map(m => ({ role: m.role, content: m.content })),
            session.senderName,
        );

        if (!aiResponseText) {
            console.error('[IgBot] Empty response from booking agent');
            return;
        }

        if (confirmedBooking) {
            session.confirmedBookings = session.confirmedBookings || [];
            session.confirmedBookings.push(confirmedBooking);
            console.log(`[IgBot] Booking CONFIRMED via Instagram: ${confirmedBooking.bookingId} for ${confirmedBooking.patientName}`);
        }

        const now = new Date().toISOString();

        // 3. Persist assistant reply in session
        session.history.push({ role: 'assistant', content: aiResponseText, timestamp: now });
        sessionsData.sessions[senderId] = session;
        await saveToBlob('ig-sessions', sessionsData);

        // 4. Store in webhook-messages buffer so Unified Inbox shows the agent's reply
        try {
            const webhookData = await loadFromBlob<{ messages: any[] }>('webhook-messages', { messages: [] });
            webhookData.messages.push({
                id: `ig-agent-${Date.now()}`,
                senderId: process.env.META_IG_USER_ID || 'fmc-instagram',
                senderName: 'Sofia (AI Agent)',
                recipientId: senderId,
                message: aiResponseText,
                timestamp: now,
                platform: 'instagram',
                read: true,
            });
            if (webhookData.messages.length > 500) {
                webhookData.messages = webhookData.messages.slice(-500);
            }
            await saveToBlob('webhook-messages', webhookData);
        } catch (bufErr) {
            console.warn('[IgBot] Could not append to webhook-messages buffer:', bufErr);
        }

        // 5. Send message back to user via Meta Graph API
        await sendInstagramMessage(senderId, aiResponseText);

    } catch (error) {
        console.error('[IgBot] Error processing message:', error);
    }
}

export async function sendInstagramMessage(recipientId: string, text: string) {
    const { SettingsStore } = await import('@/lib/settings-store');
    const settings = await SettingsStore.getSettings();

    const token = settings.messengerAccessToken || process.env.META_IG_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) {
        console.warn('[IgBot] No META_IG_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN configured. Cannot send reply.');
        return;
    }

    const igUserId = settings.metaIgUserId || process.env.META_IG_USER_ID || '17841406116856119';

    const appSecret = settings.metaAppSecret || process.env.META_APP_SECRET;
    let url = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
    if (appSecret) {
        const crypto = await import('crypto');
        const proof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
        url += `?appsecret_proof=${proof}`;
    }

    const payload = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: { text }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[IgBot] Graph API Error (${res.status}):`, errBody);
        } else {
            console.log(`[IgBot] Message successfully sent to ${recipientId}`);
        }
    } catch (e) {
        console.error('[IgBot] Failed to send Graph API request:', e);
    }
}
