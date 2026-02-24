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
            ? `Available options for "${stepName}": ${options.map((o: { name: string }) => o.name).join(', ')}`
            : '';

        const systemPrompt = `You are a friendly, professional voice booking assistant for First Medical Center in the UAE.
You help clients book medical appointments step by step.

Current booking step: ${step ?? 0} - ${stepName || 'Getting started'}
${optionsList}

INSTRUCTIONS:
1. Listen to what the client says and determine their intent.
2. If they want to select an option from the available list, respond with the matching action.
3. Be conversational and confirm their choices.
4. If you can't understand or match their request, ask them to clarify or repeat the available options.

You MUST respond with a JSON object (and NOTHING else) in this exact format:
{
  "action": "selectClinic" | "selectDept" | "selectService" | "selectDoctor" | "selectDate" | "selectSlot" | "confirm" | "goBack" | "transfer" | "none",
  "name": "the matched option name or value (empty string if action is confirm/goBack/transfer/none)",
  "spokenResponse": "What you want to say back to the client (keep it brief and friendly, under 30 words)"
}

Actions explained:
- selectClinic/selectDept/selectService/selectDoctor: when user picks an option. Set "name" to the best match.
- selectDate: when user says a date like "tomorrow", "Tuesday", "March 5th". Set "name" to what they said.
- selectSlot: when user says a time like "2pm", "10:30". Set "name" to what they said.
- confirm: when user confirms their booking at the final step.
- goBack: when user wants to go to the previous step.
- transfer: when user wants to speak with a human representative.
- none: when you need to ask a question, clarify, or the user is just chatting.`;

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
