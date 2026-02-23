import { NextResponse } from 'next/server';


export async function POST() {
    try {
        const apiKey = process.env.LIVEAVATAR_API_KEY;
        const mode = process.env.LIVEAVATAR_MODE || 'LITE';
        const avatarId = process.env.LIVEAVATAR_AVATAR_ID;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'LiveAvatar API key not configured' },
                { status: 500 }
            );
        }

        if (!avatarId || avatarId === 'CHANGE_ME') {
            return NextResponse.json(
                { error: 'LiveAvatar Avatar ID not configured' },
                { status: 500 }
            );
        }

        const response = await fetch('https://api.liveavatar.com/v1/sessions/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({
                mode,
                avatar_id: avatarId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('LiveAvatar API Error:', errorData);
            return NextResponse.json(
                { error: 'Failed to generate session token', details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error generating session token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

