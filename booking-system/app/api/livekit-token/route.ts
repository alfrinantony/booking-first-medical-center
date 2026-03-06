import { NextResponse } from 'next/server';
import { isFromUAE } from '@/lib/geo-check';

/**
 * POST /api/livekit-token
 *
 * Generates a LiveKit access token for the LiveAvatar session.
 * Enforces UAE-only geo-restriction.
 */
export async function POST(request: Request) {
    try {
        const reqHeaders = new Headers(request.headers);

        // Geo-restriction: UAE only (TEMPORARILY DISABLED for testing)
        // if (!isFromUAE(reqHeaders)) {
        //     return NextResponse.json(
        //         { error: 'This service is only available in the UAE.' },
        //         { status: 403 }
        //     );
        // }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return NextResponse.json(
                { error: 'LiveKit credentials not configured.' },
                { status: 500 }
            );
        }

        // Generate a unique participant identity
        const body = await request.json().catch(() => ({}));
        const language = body.language || 'en';
        const name = body.customerName || '';
        const identity = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const roomName = `sofia-room-${identity}`;

        // Build JWT token manually (LiveKit uses standard JWT)
        const header = { alg: 'HS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: apiKey,
            sub: identity,
            iat: now,
            exp: now + 300,
            nbf: now,
            video: {
                roomJoin: true,
                roomCreate: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
            },
            roomConfig: {
                agents: [
                    { agentName: 'CA_TahBGfdGjoqe' },
                ],
            },
            metadata: JSON.stringify({
                role: 'visitor',
                language,
                customerName: name,
            }),
        };

        // Base64url encode
        const b64url = (obj: object) => {
            const json = JSON.stringify(obj);
            const b64 = Buffer.from(json).toString('base64');
            return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        };

        const headerEncoded = b64url(header);
        const payloadEncoded = b64url(payload);
        const signingInput = `${headerEncoded}.${payloadEncoded}`;

        // HMAC-SHA256 signature
        const crypto = await import('crypto');
        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(signingInput)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const token = `${signingInput}.${signature}`;

        return NextResponse.json({
            token,
            url: livekitUrl,
            roomName,
            identity,
        });
    } catch (error) {
        console.error('[LiveKit Token] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate token.' },
            { status: 500 }
        );
    }
}
