import { NextResponse } from 'next/server';

/**
 * POST /api/whisper/transcribe
 *
 * Accepts audio blob via FormData, sends to Azure OpenAI Whisper (or OpenAI
 * direct as fallback) for transcription. Returns the transcribed text.
 */
export async function POST(request: Request) {
    try {
        /* ── API keys ── */
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const azureKey = process.env.AZURE_OPENAI_API_KEY;
        const azureVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';
        const openaiKey = process.env.OPENAI_API_KEY;

        const useAzure = !!(azureEndpoint && azureKey);

        if (!useAzure && !openaiKey) {
            return NextResponse.json(
                { error: 'No OpenAI / Azure OpenAI credentials configured.' },
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

        // Build FormData for Whisper API
        const whisperForm = new FormData();
        whisperForm.append('file', audioFile, 'recording.webm');

        if (language) {
            whisperForm.append('language', language);
        }

        /* ── Call Whisper (Azure or OpenAI direct) ── */
        let apiUrl: string;
        const headers: Record<string, string> = {};

        if (useAzure) {
            const base = azureEndpoint!.replace(/\/$/, '');
            apiUrl = `${base}/openai/deployments/whisper/audio/transcriptions?api-version=${azureVersion}`;
            headers['api-key'] = azureKey!;
            console.log('[Sofia/STT] Using Azure OpenAI Whisper');
        } else {
            apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
            headers['Authorization'] = `Bearer ${openaiKey}`;
            whisperForm.append('model', 'whisper-1');
            console.log('[Sofia/STT] Using OpenAI direct Whisper');
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: whisperForm,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Sofia/STT] Whisper API error:', response.status, errorText);
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
        console.error('[Sofia/STT] Transcription error:', error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio.' },
            { status: 500 }
        );
    }
}
