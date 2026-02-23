import { NextRequest, NextResponse } from 'next/server';

// These should be in environment variables
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_secure_verify_token';
// const APP_SECRET = process.env.META_APP_SECRET;

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log('Received webhook event:', JSON.stringify(body, null, 2));

        if (body.object === 'page' || body.object === 'instagram' || body.object === 'whatsapp_business_account') {

            // TODO: Normalize message and store in DB/Store
            // For now, we just log it.
            // In a real app, we would parse body.entry[0].messaging[0] etc.

            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else {
            return new NextResponse('Unknown event type', { status: 404 });
        }

    } catch (error) {
        console.error('Error handling webhook:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
