import { loadFromBlob, saveToBlob } from './blob-persistence';

export interface WaSession {
    senderPhone: string;
    senderName?: string;
    history: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
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
            session = { senderPhone, senderName, history: [] };
        } else if (senderName && !session.senderName) {
            session.senderName = senderName; // Update name if we just learned it
        }

        // Add user message
        session.history.push({ role: 'user', content: messageContent, timestamp: new Date().toISOString() });

        // Keep last 10 messages for context window
        if (session.history.length > 10) {
            session.history = session.history.slice(-10);
        }

        const nameContext = session.senderName ? `The user's name is ${session.senderName}. Greet them personally! ` : '';

        // 2. Build AI Prompt
        const systemPrompt = `You are the official WhatsApp Assistant for First Medical Center LLC, a premium clinic in Dubai (Branches: Al Muraqabat, Al Qiyadah, Silicon Oasis).

YOUR IDENTITY & TONE:
- Professional, warm, helpful, and concise.
- Use emojis naturally but professionally. ✨
- Structure information with bullet points or WhatsApp bold formatting (*word*) for readability.
- ${nameContext}

YOUR GOAL & ADVANTAGE:
Because the user is chatting on WhatsApp, WE ALREADY HAVE THEIR PHONE NUMBER. You DO NOT need to ask for their phone number!
Instead, answer their questions about services, prices, or availability, and then encourage them to finalize their booking seamlessly.
If they are ready to book, politely tell them that an agent will call them momentarily to pick a convenient time slot, OR they can book instantly via our website portal. DO NOT pretend to book the appointment yourself.

OUR CORE SERVICES:
Laser Hair Removal (Candela & Lumenis), Electrolysis, Hydrafacial, PRP, Fillers (Hair & Face), Mesotherapy, Profhilo, Jalupro, Sculptra, Botox, Chemical Peels, Skin Rejuvenation, CO2 Fractional Laser, Pico Laser, Acne/Scar Treatments, Tattoo Removal.

RULES:
1. Keep answers brief. WhatsApp messages should be easy to skim.
2. If asked about prices, say prices vary based on the doctor's consultation, but offer a starting price if requested, or invite them for a consultation.
3. If asked about locations, list our 3 branches clearly.
4. If a medical emergency or serious condition is mentioned, advise them to visit the clinic immediately or consult a doctor in person.
5. Provide responses in the same language the user writes in (e.g. Arabic if they write Arabic).
`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...session.history.map(m => ({ role: m.role, content: m.content }))
        ];

        // 3. Call Azure OpenAI
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const azureKey = process.env.AZURE_OPENAI_API_KEY;
        const azureDeploy = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
        const openaiKey = process.env.OPENAI_API_KEY;

        let apiUrl = '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (azureEndpoint) {
            const base = azureEndpoint.replace(/\/$/, '');
            apiUrl = `${base}/openai/deployments/${azureDeploy}/chat/completions?api-version=2024-06-01`;
            if (azureKey) {
                headers['api-key'] = azureKey;
            } else {
                const { DefaultAzureCredential } = await import('@azure/identity');
                const credential = new DefaultAzureCredential();
                const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
                if (token) {
                    headers['Authorization'] = `Bearer ${token.token}`;
                }
            }
        } else if (openaiKey) {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${openaiKey}`;
        } else {
            console.warn('[WaBot] No OpenAI API keys configured. Skipping response.');
            return;
        }

        const requestBody: any = {
            messages,
            temperature: 0.5,
            max_tokens: 300,
        };

        if (!azureEndpoint) {
            requestBody.model = 'gpt-4o-mini';
        }

        const openaiRes = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
        
        if (!openaiRes.ok) {
            console.error('[WaBot] OpenAI API error:', await openaiRes.text());
            return;
        }

        const openaiData = await openaiRes.json();
        const aiResponseText = openaiData.choices?.[0]?.message?.content?.trim();

        if (!aiResponseText) {
            console.error('[WaBot] Empty response from OpenAI');
            return;
        }

        // Add AI response to history
        session.history.push({ role: 'assistant', content: aiResponseText, timestamp: new Date().toISOString() });
        sessionsData.sessions[senderPhone] = session;
        
        // Save history
        await saveToBlob('wa-sessions', sessionsData);

        // 4. Send message back to user via Meta WhatsApp Cloud API
        await sendWhatsAppMessage(senderPhone, phoneNumberId, aiResponseText);

    } catch (error) {
        console.error('[WaBot] Error processing message:', error);
    }
}

export async function sendWhatsAppMessage(recipientPhone: string, phoneNumberId: string, text: string) {
    const { SettingsStore } = await import('@/lib/settings-store');
    const settings = await SettingsStore.getSettings();
    
    // Prioritize dedicated whatsapp token, fallback to shared messenger token or env var
    const token = settings.whatsappAccessToken || settings.messengerAccessToken || process.env.META_PAGE_ACCESS_TOKEN;
    
    if (!token) {
        console.warn('[WaBot] No WhatsApp Access Token configured. Cannot send reply.');
        return;
    }

    // Use provided phoneNumberId, fall back to env var (META_WA_PHONE_NUMBER_ID = 518094511384485)
    const resolvedPhoneNumberId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID;
    if (!resolvedPhoneNumberId) {
        console.warn('[WaBot] No WhatsApp Phone Number ID available. Cannot send reply.');
        return;
    }

    // https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
    let url = `https://graph.facebook.com/v21.0/${resolvedPhoneNumberId}/messages`;
    const appSecret = process.env.META_APP_SECRET;
    
    if (appSecret) {
        const crypto = await import('crypto');
        const appSecretProof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
        url += `?appsecret_proof=${appSecretProof}`;
    }
    
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
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
        } else {
            console.log(`[WaBot] Message successfully sent to ${recipientPhone}`);
        }
    } catch (e) {
        console.error('[WaBot] Failed to send WhatsApp Graph API request:', e);
    }
}
