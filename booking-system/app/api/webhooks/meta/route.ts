export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { loadFromBlob, saveToBlob } from '@/lib/blob-persistence';

// ─────────────────────────────────────────────────────────────
// Meta Webhook — Receives real-time events from Facebook/Instagram/WhatsApp
// Stores incoming DMs in blob for the inbox to pick up.
// ─────────────────────────────────────────────────────────────

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_secure_verify_token';

interface StoredWebhookMessage {
    id: string;
    senderId: string;
    senderName?: string;
    recipientId: string;
    message: string;
    timestamp: string;
    platform: 'facebook' | 'instagram' | 'whatsapp';
    read: boolean;
}

/**
 * GET — Webhook verification (required by Meta)
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[MetaWebhook] VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

/**
 * POST — Receive events from Meta (messages, comments, etc.)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('[MetaWebhook] Event:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            // Facebook Messenger messages
            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    if (event.message) {
                        const msg: StoredWebhookMessage = {
                            id: event.message.mid || `fb-${Date.now()}`,
                            senderId: event.sender?.id || '',
                            recipientId: event.recipient?.id || '',
                            message: event.message.text || '[Attachment]',
                            timestamp: new Date(event.timestamp || Date.now()).toISOString(),
                            platform: 'facebook',
                            read: false,
                        };
                        await storeWebhookMessage(msg);
                    }
                }
            }
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        }

        if (body.object === 'instagram') {
            // Instagram DM messages
            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    if (event.message) {
                        const msg: StoredWebhookMessage = {
                            id: event.message.mid || `ig-${Date.now()}`,
                            senderId: event.sender?.id || '',
                            recipientId: event.recipient?.id || '',
                            message: event.message.text || '[Attachment]',
                            timestamp: new Date(event.timestamp || Date.now()).toISOString(),
                            platform: 'instagram',
                            read: false,
                        };
                        await storeWebhookMessage(msg);

                        // Trigger the Automated Instagram Chatbot asynchronously
                        // Do not await here so we can return 200 OK immediately
                        if (event.message.text) {
                            try {
                                const { processInstagramMessage } = await import('@/lib/instagram-bot');
                                processInstagramMessage(msg.senderId, event.message.text).catch(err => {
                                    console.error('[MetaWebhook] Background processing error:', err);
                                });
                            } catch (err) {
                                console.error('[MetaWebhook] Failed to import/run bot:', err);
                            }
                        }
                    }
                }
            }
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        }

        if (body.object === 'whatsapp_business_account') {
            // WhatsApp messages (future use)
            console.log('[MetaWebhook] WhatsApp event received (not processed yet)');
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        }

        return new NextResponse('Unknown event type', { status: 404 });
    } catch (error) {
        console.error('[MetaWebhook] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

/**
 * Store an incoming webhook message in blob storage.
 * Messages are stored in a rolling buffer (last 500 messages).
 */
async function storeWebhookMessage(msg: StoredWebhookMessage) {
    try {
        const data = await loadFromBlob<{ messages: StoredWebhookMessage[] }>(
            'webhook-messages',
            { messages: [] },
        );
        data.messages.push(msg);
        // Keep only last 500 messages to prevent unbounded growth
        if (data.messages.length > 500) {
            data.messages = data.messages.slice(-500);
        }
        await saveToBlob('webhook-messages', data);
        console.log(`[MetaWebhook] Stored ${msg.platform} message from ${msg.senderId}`);
    } catch (err) {
        console.error('[MetaWebhook] Failed to store message:', err);
    }
}
