import { loadFromBlob, saveToBlob } from './blob-persistence';
import { generateAgentReply } from './booking-agent';

export interface WaSession {
    senderPhone: string;
    senderName?: string;
    history: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
    confirmedBookings?: any[];
}

export async function processWhatsAppMessage(
    senderPhone: string,
    phoneNumberId: string,
    messageContent: string,
    senderName?: string
) {
    try {
        console.log(`[WaBot] Processing message from ${senderPhone} (Name: ${senderName || 'Unknown'}): ${messageContent}`);

        // 1. Load Session History
        const sessionsData = await loadFromBlob<{ sessions: Record<string, WaSession> }>('wa-sessions', { sessions: {} });

        let session = sessionsData.sessions[senderPhone];
        if (!session) {
            session = { senderPhone, senderName, history: [], confirmedBookings: [] };
        } else if (senderName && !session.senderName) {
            session.senderName = senderName;
        }

        // Add user message to history
        session.history.push({ role: 'user', content: messageContent, timestamp: new Date().toISOString() });

        // Keep last 12 messages for context window
        if (session.history.length > 12) {
            session.history = session.history.slice(-12);
        }

        // 2. Generate reply and handle booking via unified booking agent
        const { text: aiResponseText, confirmedBooking } = await generateAgentReply(
            'whatsapp',
            session.history.map(m => ({ role: m.role, content: m.content })),
            session.senderName,
        );

        if (!aiResponseText) {
            console.error('[WaBot] Empty response from booking agent');
            return;
        }

        if (confirmedBooking) {
            session.confirmedBookings = session.confirmedBookings || [];
            session.confirmedBookings.push(confirmedBooking);
            console.log(`[WaBot] Booking CONFIRMED via WhatsApp: ${confirmedBooking.bookingId} for ${confirmedBooking.patientName}`);
        }

        const now = new Date().toISOString();

        // 3. Persist assistant reply in session
        session.history.push({ role: 'assistant', content: aiResponseText, timestamp: now });
        sessionsData.sessions[senderPhone] = session;
        await saveToBlob('wa-sessions', sessionsData);

        // 4. Also store in webhook-messages buffer so Unified Inbox shows the agent's reply
        try {
            const webhookData = await loadFromBlob<{ messages: any[] }>('webhook-messages', { messages: [] });
            webhookData.messages.push({
                id: `wa-agent-${Date.now()}`,
                senderId: phoneNumberId || 'fmc-clinic',
                senderName: 'Sofia (AI Agent)',
                recipientId: senderPhone,
                message: aiResponseText,
                timestamp: now,
                platform: 'whatsapp',
                read: true,
            });
            if (webhookData.messages.length > 500) {
                webhookData.messages = webhookData.messages.slice(-500);
            }
            await saveToBlob('webhook-messages', webhookData);
        } catch (bufErr) {
            console.warn('[WaBot] Could not append to webhook-messages buffer:', bufErr);
        }

        // 5. Send reply back to user via WhatsApp Cloud API
        await sendWhatsAppMessage(senderPhone, phoneNumberId, aiResponseText);

    } catch (error) {
        console.error('[WaBot] Error processing message:', error);
    }
}

export async function sendWhatsAppMessage(
    recipientPhone: string,
    phoneNumberId: string,
    text: string
): Promise<{ success: boolean; error?: string }> {
    const { SettingsStore } = await import('@/lib/settings-store');
    const settings = await SettingsStore.getSettings();
    
    // Prioritize dedicated whatsapp token, fallback to shared messenger token or env var
    const token = settings.whatsappAccessToken || process.env.META_WA_ACCESS_TOKEN || settings.messengerAccessToken || process.env.META_PAGE_ACCESS_TOKEN;
    
    console.log(`[WaBot] Using token starting with: ${token?.substring(0, 20)}...`);
    
    if (!token) {
        console.warn('[WaBot] No WhatsApp Access Token configured. Cannot send reply.');
        return { success: false, error: 'No WhatsApp Access Token configured in Settings' };
    }

    // Resolve phoneNumberId, prioritizing settings.metaPhoneId, with fallback to First Medical Center's production Phone Number ID
    let resolvedPhoneNumberId = phoneNumberId || settings.metaPhoneId || process.env.META_WA_PHONE_NUMBER_ID || '1085224931341556';
    
    // Safety check: 518094511384485 is the WhatsApp Business Account (WABA) ID, not the Phone Number ID!
    // If the WABA ID was passed, auto-map to the actual Phone Number ID (1085224931341556)
    if (resolvedPhoneNumberId === '518094511384485' || resolvedPhoneNumberId === '1059480356695707' || resolvedPhoneNumberId === '2177289126457948' || resolvedPhoneNumberId === 'fmc-clinic') {
        resolvedPhoneNumberId = '1085224931341556';
    }

    let url = `https://graph.facebook.com/v21.0/${resolvedPhoneNumberId}/messages`;
    const appSecret = settings.metaAppSecret || process.env.META_APP_SECRET;
    
    if (appSecret) {
        const crypto = await import('crypto');
        const appSecretProof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
        url += `?appsecret_proof=${appSecretProof}`;
    }
    
    const cleanPhone = recipientPhone.replace(/[^\d+]/g, '');
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { preview_url: false, body: text }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[WaBot] WhatsApp Graph API Error (${res.status}):`, errBody);
            let userMessage = errBody;
            try {
                const parsed = JSON.parse(errBody);
                userMessage = parsed.error?.message || errBody;
            } catch {}
            return { success: false, error: `Meta API (${res.status}): ${userMessage}` };
        } else {
            console.log(`[WaBot] Message successfully sent to ${cleanPhone}`);
            return { success: true };
        }
    } catch (e: any) {
        console.error('[WaBot] Failed to send WhatsApp Graph API request:', e);
        return { success: false, error: e.message || 'Network exception sending WhatsApp message' };
    }
}
