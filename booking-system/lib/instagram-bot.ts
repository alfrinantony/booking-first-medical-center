import { loadFromBlob, saveToBlob } from './blob-persistence';

// Session state to keep track of recent conversations per user
export interface IgSession {
    senderId: string;
    history: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
}

export async function processInstagramMessage(senderId: string, message: string) {
    try {
        console.log(`[IgBot] Processing message from ${senderId}: ${message}`);

        // 1. Load Session History
        const sessionsData = await loadFromBlob<{ sessions: Record<string, IgSession> }>('ig-sessions', { sessions: {} });
        
        let session = sessionsData.sessions[senderId];
        if (!session) {
            session = { senderId, history: [] };
        }

        // Add user message
        session.history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

        // Keep only last 10 messages for context window
        if (session.history.length > 10) {
            session.history = session.history.slice(-10);
        }

        // 2. Build AI Prompt
        const systemPrompt = `You are the official Instagram Assistant for First Medical Center LLC, a premium clinic in Dubai (Branches: Al Muraqabat, Al Qiyadah, Silicon Oasis).

YOUR IDENTITY & TONE:
- Friendly, warm, helpful, and concise.
- Use emojis naturally but professionally ✨
- Write in short paragraphs suitable for Instagram DMs.
- Always be polite and attentive.

YOUR GOAL:
Answer customer questions about our services, pricing, and availability. But most importantly, ACT AS A LEAD GENERATOR. If they want to book an appointment, politely ask them for their **Name and WhatsApp Number**, and tell them our booking team will contact them immediately to confirm their slot. You do NOT make the final booking yourself.

OUR CORE SERVICES:
Laser Hair Removal (Candela & Lumenis), Electrolysis, Hydrafacial, PRP, Fillers (Hair & Face), Mesotherapy, Profhilo, Jalupro, Sculptra, Botox, Chemical Peels, Skin Rejuvenation, CO2 Fractional Laser, Pico Laser, Acne/Scar Treatments, Tattoo Removal.

RULES:
1. Keep answers brief (Instagram users have short attention spans).
2. If asked about prices, say prices vary based on the doctor's consultation, but offer a starting price if requested, or invite them for a consultation.
3. If asked about branches, list our 3 branches.
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
            console.warn('[IgBot] No OpenAI API keys configured. Skipping response.');
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
            console.error('[IgBot] OpenAI API error:', await openaiRes.text());
            return;
        }

        const openaiData = await openaiRes.json();
        const aiResponseText = openaiData.choices?.[0]?.message?.content?.trim();

        if (!aiResponseText) {
            console.error('[IgBot] Empty response from OpenAI');
            return;
        }

        // Add AI response to history
        session.history.push({ role: 'assistant', content: aiResponseText, timestamp: new Date().toISOString() });
        sessionsData.sessions[senderId] = session;
        await saveToBlob('ig-sessions', sessionsData);

        // 4. Send message back to user via Meta Graph API
        await sendInstagramMessage(senderId, aiResponseText);

    } catch (error) {
        console.error('[IgBot] Error processing message:', error);
    }
}

async function sendInstagramMessage(recipientId: string, text: string) {
    const token = process.env.META_IG_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) {
        console.warn('[IgBot] No META_IG_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN configured. Cannot send reply.');
        return;
    }

    // Must use the IG Business User ID as the sender, NOT /me — otherwise Meta returns a permission error
    const igUserId = process.env.META_IG_USER_ID;
    if (!igUserId) {
        console.warn('[IgBot] META_IG_USER_ID not set. Cannot send Instagram reply.');
        return;
    }

    const url = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
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
