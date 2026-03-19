export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

interface SendMessageRequest {
    platform: 'facebook' | 'instagram' | 'whatsapp';
    recipientId: string;
    message: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: SendMessageRequest = await req.json();
        const { platform, recipientId, message } = body;

        if (!platform || !recipientId || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`Sending message to ${platform} user ${recipientId}: ${message}`);

        // Mock success response
        // In a real implementation, you would make a fetch call to the respective Meta Graph API endpoint
        // e.g. https://graph.facebook.com/v19.0/me/messages?access_token=...

        const mockResponse = {
            success: true,
            messageId: `mid_${Date.now()}`,
            platform,
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(mockResponse);

    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
