import { NextResponse } from 'next/server';

/**
 * POST /api/voice-agent/transfer
 *
 * Triggered when a booking-page client requests to speak with a human representative.
 * Sends a webhook notification to the configured URL so the clinic staff can take over.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sessionId, timestamp, source } = body;

        const webhookUrl = process.env.VOICE_AGENT_TRANSFER_WEBHOOK_URL;

        const payload = {
            event: 'voice_agent.transfer_requested',
            sessionId: sessionId || `session-${Date.now()}`,
            timestamp: timestamp || new Date().toISOString(),
            source: source || 'booking-page',
            message: 'Client has requested to speak with a human representative during booking.',
        };

        // Fire webhook if configured
        if (webhookUrl) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                console.log('[VoiceAgent] Transfer webhook sent to:', webhookUrl);
            } catch (err) {
                console.error('[VoiceAgent] Webhook delivery failed:', err);
                // Still return success to client — webhook failure is non-blocking
            }
        } else {
            console.warn('[VoiceAgent] No VOICE_AGENT_TRANSFER_WEBHOOK_URL configured. Transfer logged only.');
        }

        // Always log the transfer request
        console.log('[VoiceAgent] Transfer requested:', JSON.stringify(payload));

        return NextResponse.json({
            success: true,
            message: 'Transfer request received. A representative will be notified.',
        });
    } catch (error) {
        console.error('[VoiceAgent] Transfer API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process transfer request.' },
            { status: 500 }
        );
    }
}
