import { NextResponse } from 'next/server';

/**
 * POST /api/tts
 *
 * Converts text to speech using OpenAI TTS-1 with the shimmer voice.
 * Returns audio/mpeg stream that the browser can play directly.
 */
export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY not configured.' }, { status: 500 });
        }

        const body = await request.json();
        const { text, lang } = body;

        if (!text?.trim()) {
            return NextResponse.json({ error: 'No text provided.' }, { status: 400 });
        }

        // Select voice based on language — shimmer for English, nova for Arabic
        const voice = lang === 'ar' ? 'nova' : 'shimmer';

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice,
                response_format: 'mp3',
                speed: 1.0,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TTS] OpenAI TTS error:', response.status, errorText);
            return NextResponse.json({ error: `TTS API error: ${response.status}` }, { status: 502 });
        }

        // Stream audio directly back to browser
        const audioBuffer = await response.arrayBuffer();

        return new Response(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audioBuffer.byteLength),
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('[TTS] Error:', error);
        return NextResponse.json({ error: 'Failed to generate speech.' }, { status: 500 });
    }
}
