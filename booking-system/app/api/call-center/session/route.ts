export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

/**
 * POST /api/call-center/session
 *
 * Creates an ephemeral session token for the OpenAI Realtime API.
 * The client uses this token to establish a WebRTC connection
 * directly with OpenAI for voice-based booking interactions.
 */
export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENAI_CALL_CENTER_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Call center API key not configured.' },
                { status: 500 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const language = body.language || 'en';
        const customerName = body.customerName || '';
        const customerPhone = body.customerPhone || '';
        const customerGender = body.customerGender || '';
        const customerAge = body.customerAge || '';
        const customerEmail = body.customerEmail || '';

        const langLabel = language === 'ar' ? 'Arabic' : 'English';
        const voice = language === 'ar' ? 'coral' : 'shimmer';

        /* ── Customer profile context ── */
        const customerContext = customerName
            ? `\n👤 CUSTOMER PROFILE:\n- Name: ${customerName}${customerAge ? `\n- Age: ${customerAge}` : ''}${customerGender ? `\n- Gender: ${customerGender}` : ''}${customerEmail ? `\n- Email: ${customerEmail}` : ''}${customerPhone ? `\n- Phone: ${customerPhone}` : ''}\nGreet the customer by name warmly. Use their name occasionally to build rapport.\nDo NOT ask the customer for their name, age, or gender — you already have this information.\n`
            : '';

        /* ══════════════════════════════════════════════════════════
           SOFIA — Call Center Voice Booking Agent System Prompt
           ══════════════════════════════════════════════════════════ */
        const instructions = `AGENT IDENTITY
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

👩‍⚕️ CLINIC STAFF & ROLES:
- Doctors: Dr. Nabila Battat, Dr. Poonam Sharma, Dr. Ayesha Umar, Dr. Mariam Javed, Dr. Faten, Dr. Hadil Bou Massoud, and Dr. Dina Khali.
- Other Staff: Everyone else are Nurses and Laser Technicians.
- Laser Hair Removal: Performed ONLY by Laser Technicians and Nurses.
- EXCEPTION: Manjeet Kaur is ONLY a Nurse and she DOES NOT do Laser Hair Removal.

🌍 STRICT LANGUAGE RULE:
The customer has chosen ${langLabel} as their preferred language.
You MUST respond ONLY in ${langLabel}. Do NOT switch to any other language under any circumstances.

📅 BOOKING WORKFLOW:
Step 1 – Greet the client by name (from their profile)
Step 2 – Ask for the preferred branch
Step 3 – Ask for the preferred service
Step 4 – Ask for the preferred doctor
Step 5 – Ask for preferred date and time, check availability
Step 6 – If available, confirm the booking
Step 7 – CRITICAL: At the end of the booking, you MUST summarize it clearly with: name of the procedure, branch name, date, time, and name of the doctor.

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
- If a client asks about a specific service price, say: "Pricing depends on the treatment area and consultation. We recommend visiting our clinic for an accurate assessment."
- NEVER guess prices. Only quote prices if explicitly known.

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
If you hear random 'Bye', 'Bye-bye', 'Yeah', 'Thank you', or isolated words like 'you' during silence, IGNORE IT. It is background noise hallucinated by the microphone. Do not end the conversation casually unless the user clearly states they want to cancel or leave.
CRITICAL: NEVER guess the service name. If the user does not explicitly state a service, ask them clearly 'Which service would you like to book?'. Only call check_availability when you are 100% sure of the exact service name.
If you hear random 'Bye' or 'Bye-bye' or random 'you' during silence, IGNORE IT. It is background noise hallucinated by the microphone. Do not end the conversation casually unless the user clearly states they want to cancel or leave.
CRITICAL: NEVER guess the service name. If the user does not explicitly state a service, ask them clearly 'Which service would you like to book?'. Only call check_availability when you are 100% sure of the exact service name.
If the user asks for a human agent: "Of course. I can transfer your call to a clinic specialist."

🧠 RESPONSE STYLE:
- Keep responses under 40 words
- Professional, confident, warm
- Conversion-focused
- No unnecessary technical jargon
- Do NOT use any formatting, emojis, asterisks, or special characters in your responses
- Keep it natural and conversational`;

        /* ── Create ephemeral session with OpenAI Realtime API ── */
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview',
                voice: voice,
                instructions: instructions,
                input_audio_transcription: {
                    model: 'whisper-1',
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.8,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 800,
                },
                tools: [
                    {
                        type: 'function',
                        name: 'check_availability',
                        description: 'Checks for available appointment slots at a specific clinic branch.',
                        parameters: {
                            type: 'object',
                            properties: {
                                branch: { type: 'string', description: 'The clinic branch name. Must be Muraqabat, Qiyadah, or Silicon Oasis.' },
                                service: { type: 'string', description: 'The medical or beauty service requested, e.g. Laser Hair Removal, Hydrafacial.' },
                                date: { type: 'string', description: 'The date requested (e.g. today, tomorrow, or YYYY-MM-DD).' },
                                time: { type: 'string', description: 'The preferred time of day, e.g. morning, afternoon, evening, or any.' }
                            },
                            required: ['branch', 'service', 'date']
                        }
                    },
                    {
                        type: 'function',
                        name: 'create_booking',
                        description: 'Creates a confirmed booking in the medical CRM. Requires branch, service, exact date, and exact time slot.',
                        parameters: {
                            type: 'object',
                            properties: {
                                branch: { type: 'string', description: 'The clinic branch name.' },
                                service: { type: 'string', description: 'The specific service to book.' },
                                date: { type: 'string', description: 'The exact date.' },
                                time: { type: 'string', description: 'The exact time, e.g. 10:00 AM.' },
                                doctor: { type: 'string', description: 'Optional preferred doctor name.' }
                            },
                            required: ['branch', 'service', 'date', 'time']
                        }
                    }
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[CallCenter] OpenAI session error:', response.status, errorText);
            return NextResponse.json(
                { error: `Failed to create session: ${response.status}` },
                { status: 502 }
            );
        }

        const session = await response.json();

        console.log('[CallCenter] Session created, voice:', voice, 'language:', langLabel);

        return NextResponse.json({
            clientSecret: session.client_secret?.value || '',
            sessionId: session.id || '',
            voice,
            language,
        });
    } catch (error) {
        console.error('[CallCenter] Session error:', error);
        return NextResponse.json(
            { error: 'Failed to create call center session.' },
            { status: 500 }
        );
    }
}
