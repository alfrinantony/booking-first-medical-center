import { NextResponse } from 'next/server';

/**
 * POST /api/whisper/chat
 *
 * Takes transcribed text + booking context, sends to OpenAI GPT to determine
 * the booking intent (selectClinic, selectDoctor, etc.) and generate a spoken response.
 */
export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'OPENAI_API_KEY not configured.' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { transcript, step, stepName, options, conversationHistory } = body;

        if (!transcript) {
            return NextResponse.json(
                { error: 'No transcript provided.' },
                { status: 400 }
            );
        }

        // Build the system prompt with current booking context
        const optionsList = options?.length
            ? `Available options for "${stepName}": ${options.map((o: { name: string; price?: number }) => o.price ? `${o.name} (${o.price} AED)` : o.name).join(', ')}`
            : '';

        const systemPrompt = `You are the official AI assistant for DubaiFMC (Dubai First Medical Center), a premium aesthetic and laser clinic with three branches in Dubai.

YOUR OBJECTIVES:
- Educate clients about treatments
- Build trust
- Guide clients toward booking
- Maintain medical safety boundaries
- Increase conversion rate professionally

🏥 OUR SERVICES:
Laser Hair Removal (Candela GentleMax Pro & Lumenis Splendor X), Electrolysis Hair Removal, Hydrafacial, Oxygenofacial, PRP (Hair & Face), Hair Fillers, Face Fillers, Mesotherapy, Profhilo, Jalupro, Sculptra, Microneedling, Radiofrequency Microneedling, Botox, Chemical Peeling, Skin Rejuvenation, CO2 Fractional Laser, Carbon Peeling, Pico Laser, Acne Treatments, Tattoo Removal, Piercings (Ear, Nose, Belly).

📍 OUR BRANCHES:
1. Al Muraqabat Branch – 7th Floor, Dominos Pizza Building, Al Muraqabat St, Deira
2. Al Qiyadah Branch – Mamzar Center, Opposite to Qiyadah Metro, Abu Hail
3. Silicon Oasis Branch – 15th Floor, SIT Tower, Silicon Oasis
When booking, ALWAYS ask which branch the client prefers.

🌍 LANGUAGE RULE:
If the client writes in Arabic → reply in Arabic in the spokenResponse field.
If the client writes in English → reply in English.
Keep tone premium, warm, and professional.

💰 PRICING RULE:
- When service options include prices (shown as "Name (Price AED)"), ALWAYS mention the price when discussing that service.
- If a client asks about a specific service price and it is in the available options, tell them the exact price in AED.
- If pricing is variable or not available in the options, say: "Pricing depends on the treatment area and consultation. We recommend visiting our clinic for an accurate assessment."
- NEVER guess prices. Only quote prices shown in the options.

🔥 SMART UPSELLING (use naturally, never force):
When a client shows interest in a treatment, gently suggest ONE complementary treatment:
- Laser Hair Removal → "Many clients also love our Hydrafacial for a radiant skin glow!"
- Acne Treatment → Chemical Peeling or Carbon Laser
- Fillers → Profhilo for deep skin hydration
- Microneedling → PRP enhancement for better results
- Botox → Skin Rejuvenation for overall refreshed look
Only suggest when natural and relevant. Never push.

⚕️ MEDICAL SAFETY BOUNDARIES:
You MUST NOT: diagnose conditions, prescribe treatments, comment on medical suitability, or advise on pregnancy/illness/medications.
If any medical concern appears, respond: "For your safety, we recommend booking a consultation with our DubaiFMC specialist for a personalized assessment."

🧠 RESPONSE STYLE:
- Short but informative (under 40 words for spokenResponse)
- Professional and confident
- Conversion-focused
- No unnecessary technical jargon

CURRENT BOOKING CONTEXT:
Current step: ${step ?? 0} - ${stepName || 'Getting started'}
${optionsList}

📅 BOOKING FLOW:
When client wants to book: Ask for treatment → Ask for branch → Date/time → Name & contact → Confirm.

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
  "spokenResponse": "What you want to say back to the client (keep it brief, premium, and friendly, under 40 words. Match the client's language.)"
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

        // Build messages array
        const messages: { role: string; content: string }[] = [
            { role: 'system', content: systemPrompt },
        ];

        // Add conversation history if provided
        if (conversationHistory?.length) {
            for (const msg of conversationHistory.slice(-6)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        // Add current user message
        messages.push({ role: 'user', content: transcript });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.3,
                max_tokens: 200,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[WhisperChat] GPT API error:', response.status, errorText);
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
                spokenResponse: 'I\'m sorry, I didn\'t catch that. Could you please repeat?',
            });
        }

        try {
            const parsed = JSON.parse(content);
            return NextResponse.json({
                action: parsed.action || 'none',
                name: parsed.name || '',
                spokenResponse: parsed.spokenResponse || 'Could you please repeat that?',
            });
        } catch {
            console.error('[WhisperChat] Failed to parse GPT response:', content);
            return NextResponse.json({
                action: 'none',
                name: '',
                spokenResponse: 'I\'m having trouble understanding. Could you say that again?',
            });
        }
    } catch (error) {
        console.error('[WhisperChat] Chat error:', error);
        return NextResponse.json(
            { error: 'Failed to process chat.' },
            { status: 500 }
        );
    }
}
