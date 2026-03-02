import { NextResponse } from 'next/server';

/**
 * POST /api/whisper/transcribe
 *
 * Accepts audio blob via FormData, sends to OpenAI Whisper API for transcription.
 * Returns the transcribed text.
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

        const formData = await request.formData();
        const audioFile = formData.get('audio') as Blob | null;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided. Send as FormData with key "audio".' },
                { status: 400 }
            );
        }

        // Optional language hint from client (locked per session)
        const language = formData.get('language') as string | null;

        // Build FormData for OpenAI Whisper API
        const whisperForm = new FormData();
        whisperForm.append('file', audioFile, 'recording.webm');
        whisperForm.append('model', 'whisper-1');
        // Pass language hint if provided (en/ar) for more accurate transcription
        if (language) {
            whisperForm.append('language', language);
        }

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: whisperForm,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Whisper] API error:', response.status, errorText);
            return NextResponse.json(
                { error: `Whisper API error: ${response.status}` },
                { status: 502 }
            );
        }

        const result = await response.json();

        return NextResponse.json({
            text: result.text || '',
        });
    } catch (error) {
        console.error('[Whisper] Transcription error:', error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio.' },
            { status: 500 }
        );
    }
}
