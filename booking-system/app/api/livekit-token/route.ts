import { NextResponse } from 'next/server';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';

/**
 * POST /api/livekit-token
 *
 * Generates a LiveKit access token using the official server SDK,
 * with proper agent dispatch for the "Alfrin" Cloud Agent.
 */
export async function POST(request: Request) {
    try {
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return NextResponse.json(
                { error: 'LiveKit credentials not configured.' },
                { status: 500 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const language = body.language || 'en';
        const customerName = body.customerName || '';

        // Generate unique identity and room name
        const identity = `visitor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const roomName = `sofia-room-${identity}`;

        // Use the official livekit-server-sdk to create token
        const token = new AccessToken(apiKey, apiSecret, {
            identity,
            metadata: JSON.stringify({
                role: 'visitor',
                language,
                customerName,
            }),
        });

        // Grant room permissions
        token.addGrant({
            roomJoin: true,
            roomCreate: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        // Set room configuration for agent dispatch
        // The agentName MUST match the agent's registered name: "Alfrin"
        const agentDispatch = new RoomAgentDispatch({ agentName: 'Alfrin' });
        token.roomConfig = new RoomConfiguration({ agents: [agentDispatch] });

        const jwt = await token.toJwt();

        console.log('[LiveKit Token] Generated token for room:', roomName, 'agent: Alfrin');

        return NextResponse.json({
            token: jwt,
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
