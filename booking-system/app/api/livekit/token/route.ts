import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return NextResponse.json(
                { error: 'LiveKit credentials not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in .env.local' },
                { status: 500 }
            );
        }

        // Parse optional context from request body
        let context = 'general';
        try {
            const body = await request.json();
            if (body.context) context = body.context;
        } catch {
            // No body or invalid JSON — use defaults
        }

        // Create a unique room name for this session
        const roomName = `medical-room-${Date.now()}`;
        const participantIdentity = `patient-${Date.now()}`;

        // Room metadata: tells the AI agent what context it's operating in
        const roomMetadata = JSON.stringify({
            context,
            systemPrompt: context === 'booking-assistant'
                ? 'You are a friendly booking assistant for First Medical Center. Help the client book an appointment step by step. Ask which clinic, department, service, doctor, date, and time they prefer. When the client makes a choice, send a JSON data message on the "booking-commands" topic with the action and name. For example: {"action":"selectClinic","name":"Al Muraqabat"}. Available actions: selectClinic, selectDept, selectService, selectDoctor, selectDate, selectSlot, confirm, goBack, transfer.'
                : 'You are a medical AI assistant for First Medical Center.',
        });

        // Create an access token for the user
        const token = new AccessToken(apiKey, apiSecret, {
            identity: participantIdentity,
            name: 'Patient',
            ttl: '30m', // Token valid for 30 minutes
        });

        // Grant room join permissions
        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        // Set room metadata on the token
        token.metadata = roomMetadata;

        const jwt = await token.toJwt();

        return NextResponse.json({
            token: jwt,
            url: livekitUrl,
            roomName,
        });
    } catch (error) {
        console.error('Error generating LiveKit token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

