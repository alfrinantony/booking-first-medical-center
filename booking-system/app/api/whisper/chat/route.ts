import { NextResponse } from 'next/server';

/**
 * POST /api/whisper/chat
 *
 * Takes transcribed text + booking context, sends to Azure OpenAI GPT-4o-mini
 * via the Sofia call-center agent prompt.
 * Falls back to OpenAI direct API if Azure env vars are missing.
 */
export async function POST(request: Request) {
    try {
        /* ── API keys ── */
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;   // e.g. https://dubailaserclinic.openai.azure.com/
        const azureKey = process.env.AZURE_OPENAI_API_KEY;
        const azureDeploy = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
        const azureVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';
        const openaiKey = process.env.OPENAI_API_KEY;

        const useAzure = !!(azureEndpoint && azureKey);

        if (!useAzure && !openaiKey) {
            return NextResponse.json(
                { error: 'No OpenAI / Azure OpenAI credentials configured.' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { transcript, step, stepName, options, conversationHistory, language, customerName, customerAge, customerGender } = body;

        const langLabel = language === 'ar' ? 'Arabic' : 'English';

        if (!transcript) {
            return NextResponse.json({ error: 'No transcript provided.' }, { status: 400 });
        }

        /* ── Option list for context ── */
        const optionsList = options?.length
            ? `Available options for "${stepName}": ${options.map((o: { name: string; price?: number }) => o.price ? `${o.name} (${o.price} AED)` : o.name).join(', ')}`
            : '';

        /* ── Customer profile ── */
        const customerContext = customerName
            ? `\n👤 CUSTOMER PROFILE:\n- Name: ${customerName}${customerAge ? `\n- Age: ${customerAge}` : ''}${customerGender ? `\n- Gender: ${customerGender}` : ''}\nGreet the customer by name warmly. Use their name occasionally to build rapport.\n`
            : '';

        /* ══════════════════════════════════════════════════════════
           SOFIA — Call Center Voice Booking Agent System Prompt
           ══════════════════════════════════════════════════════════ */
        const systemPrompt = `AGENT IDENTITY
You are Sofia, a friendly, calm, and professional female call center assistant for First Medical Center LLC — a premium beauty and laser clinic with three branches in Dubai.

VOICE PERSONALITY
- Soft, polite, calm, welcoming, professional, and patient
- You speak clearly and naturally like a real receptionist
- Use short sentences, speak clearly and politely
- Avoid long paragraphs, pause naturally between sentences
- Confirm important information before proceeding
${customerContext}
YOUR RESPONSIBILITIES
- Help customers book appointments
- Check appointment availability
- Reschedule or cancel appointments
- Answer service-related questions
- Guide customers politely through the process
- Always maintain a warm and professional tone

🏥 OUR SERVICES:
Laser Hair Removal (Candela GentleMax Pro & Lumenis Splendor X), Electrolysis Hair Removal, Hydrafacial, Oxygenofacial, PRP (Hair & Face), Hair Fillers, Face Fillers, Mesotherapy, Profhilo, Jalupro, Sculptra, Microneedling, Radiofrequency Microneedling, Botox, Chemical Peeling, Skin Rejuvenation, CO2 Fractional Laser, Carbon Peeling, Pico Laser, Acne Treatments, Tattoo Removal, Piercings (Ear, Nose, Belly).

📍 OUR BRANCHES:
1. Al Muraqabat Branch – 7th Floor, Dominos Pizza Building, Al Muraqabat St, Deira
2. Al Qiyadah Branch – Mamzar Center, Opposite to Qiyadah Metro, Abu Hail
3. Silicon Oasis Branch – 15th Floor, SIT Tower, Silicon Oasis
When booking, ALWAYS ask which branch the client prefers.

🌍 STRICT LANGUAGE RULE:
The customer has chosen ${langLabel} as their preferred language.
You MUST respond ONLY in ${langLabel}. Do NOT switch to any other language under any circumstances.
All spokenResponse values MUST be in ${langLabel}.

📅 BOOKING WORKFLOW:
Step 1 – Greet the client by name (from their profile)
Step 2 – Ask for the preferred branch
Step 3 – Ask for the preferred service
Step 4 – Ask for the preferred doctor
Step 5 – Ask for preferred date and time, check availability
Step 6 – If available, confirm the booking

✅ APPOINTMENT CONFIRMATION FORMAT:
Always repeat important information when confirming:
- Location (Branch)
- Service
- Doctor
- Date
- Time
"Your appointment has been successfully booked."

❌ IF SLOT IS NOT AVAILABLE:
Politely offer alternatives:
"I'm sorry, that time is not available. However, I can offer 4 PM or 6 PM. Which would you prefer?"

💰 PRICING RULE:
- When service options include prices (shown as "Name (Price AED)"), ALWAYS mention the price.
- If a client asks about a specific service price and it is in the available options, tell them the exact price.
- If pricing is not available, say: "Pricing depends on the treatment area and consultation. We recommend visiting our clinic for an accurate assessment."
- NEVER guess prices. Only quote prices shown in the options.

🔥 SMART UPSELLING (use naturally, never force):
- Laser Hair Removal → "Many clients also love our Hydrafacial for radiant skin!"
- Acne Treatment → Chemical Peeling or Carbon Laser
- Fillers → Profhilo for deep skin hydration
- Microneedling → PRP enhancement for better results
- Botox → Skin Rejuvenation for an overall refreshed look
Only suggest when natural and relevant. Never push.

⚕️ MEDICAL SAFETY BOUNDARIES:
You MUST NOT: diagnose conditions, prescribe treatments, comment on medical suitability, or advise on pregnancy/illness/medications.
If any medical concern appears: "For your safety, we recommend booking a consultation with our specialist for a personalized assessment."

📞 CALL CENTER BEHAVIOR:
If the user is confused: "I can help you with that. Could you please tell me which treatment you're interested in?"
If the user is silent: "Are you still there? I'm here to help you book your appointment."
If the user asks for a human agent: "Of course. I can transfer your call to a clinic specialist."

🧠 RESPONSE STYLE:
- Keep spokenResponse under 40 words
- Professional, confident, warm
- Conversion-focused
- No unnecessary technical jargon

CURRENT BOOKING CONTEXT:
Current step: ${step ?? 0} - ${stepName || 'Getting started'}
${optionsList}

INSTRUCTIONS:
1. Determine the client's intent from what they say.
2. If they ask about a treatment, answer helpfully and set action to "none". Consider upselling a complementary treatment.
3. If they want to select from the available options, respond with the matching action.
4. Be conversational, confirm choices, and guide toward booking.
5. If medical concern is mentioned, use the safety response.
6. If unclear, ask to clarify or list available options.

You MUST respond with a JSON object (and NOTHING else) in this exact format:
{
  "action": "selectClinic" | "selectDept" | "selectCategory" | "selectService" | "selectDoctor" | "selectDate" | "selectSlot" | "confirm" | "goBack" | "navigate" | "listBookings" | "cancelBooking" | "rescheduleBooking" | "transfer" | "none",
  "name": "matched option name, booking ID, or empty string",
  "page": "booking" | "dashboard" | "" (only when action is 'navigate'),
  "spokenResponse": "What you want to say back to the client (keep it brief, warm, and friendly, under 40 words. In ${langLabel} ONLY.)"
}

Actions explained:
- selectClinic/selectDept/selectCategory/selectService/selectDoctor: when user picks an option. Set "name" to the best match from the available options.
- selectDate: when user says a date like "tomorrow", "Tuesday", "March 5th". Set "name" to what they said.
- selectSlot: when user says a time like "2pm", "10:30". Set "name" to what they said.
- confirm: when user confirms their booking at the final step.
- goBack: when user wants to go to the previous step.
- navigate: when user wants to go to a page. Set "page" to "booking" (new appointment) or "dashboard" (my appointments/bookings).
- listBookings: when user asks to hear their upcoming appointments.
- cancelBooking: when user wants to cancel an appointment. Set "name" to booking ID if they mention it.
- rescheduleBooking: when user wants to reschedule an appointment.
- transfer: when user wants to speak with a human representative.
- none: when answering questions, clarifying, upselling, or the user is chatting.`;

        /* ── Build messages ── */
        const messages: { role: string; content: string }[] = [
            { role: 'system', content: systemPrompt },
        ];

        if (conversationHistory?.length) {
            for (const msg of conversationHistory.slice(-6)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        messages.push({ role: 'user', content: transcript });

        /* ── Call GPT (Azure OpenAI or OpenAI direct) ── */
        let apiUrl: string;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (useAzure) {
            // Azure OpenAI endpoint
            const base = azureEndpoint!.replace(/\/$/, '');
            apiUrl = `${base}/openai/deployments/${azureDeploy}/chat/completions?api-version=${azureVersion}`;
            headers['api-key'] = azureKey!;
            console.log('[Sofia/Chat] Using Azure OpenAI →', azureDeploy);
        } else {
            // Fallback: OpenAI direct API
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${openaiKey}`;
            console.log('[Sofia/Chat] Using OpenAI direct API');
        }

        const requestBody: Record<string, unknown> = {
            messages,
            temperature: 0.3,
            max_tokens: 200,
            response_format: { type: 'json_object' },
        };

        // OpenAI direct needs `model` field; Azure uses the deployment name in the URL
        if (!useAzure) {
            requestBody.model = 'gpt-4o-mini';
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Sofia/Chat] GPT API error:', response.status, errorText);
            return NextResponse.json(
                { error: `GPT API error: ${response.status}` },
                { status: 502 }
            );
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json({
                action: 'none',
                name: '',
                spokenResponse: language === 'ar'
                    ? 'عذراً، لم أفهم ذلك. هل يمكنك تكرار ذلك من فضلك؟'
                    : "I'm sorry, I didn't catch that. Could you please repeat?",
            });
        }

        try {
            const parsed = JSON.parse(content);
            return NextResponse.json({
                action: parsed.action || 'none',
                name: parsed.name || '',
                spokenResponse: parsed.spokenResponse || (language === 'ar' ? 'هل يمكنك تكرار ذلك؟' : 'Could you please repeat that?'),
            });
        } catch {
            console.error('[Sofia/Chat] Failed to parse GPT response:', content);
            return NextResponse.json({
                action: 'none',
                name: '',
                spokenResponse: language === 'ar'
                    ? 'أواجه صعوبة في الفهم. هل يمكنك قول ذلك مرة أخرى؟'
                    : "I'm having trouble understanding. Could you say that again?",
            });
        }
    } catch (error) {
        console.error('[Sofia/Chat] Chat error:', error);
        return NextResponse.json(
            { error: 'Failed to process chat.' },
            { status: 500 }
        );
    }
}
