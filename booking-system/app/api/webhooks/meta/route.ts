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
            return new Response(challenge, { 
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        } else {
            return new Response('Forbidden', { status: 403 });
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
                        let senderName = '';
                        if (event.sender?.id) {
                            // Fetch IG user info
                            const token = process.env.META_IG_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
                            if (token) {
                                try {
                                    const userInfoRes = await fetch(`https://graph.facebook.com/v19.0/${event.sender.id}?fields=name,username&access_token=${token}`);
                                    if (userInfoRes.ok) {
                                        const userInfo = await userInfoRes.json();
                                        senderName = userInfo.name || userInfo.username || '';
                                    }
                                } catch (err) {
                                    console.error('[MetaWebhook] Failed to fetch IG user profile:', err);
                                }
                            }
                        }

                        const msg: StoredWebhookMessage = {
                            id: event.message.mid || `ig-${Date.now()}`,
                            senderId: event.sender?.id || '',
                            senderName,
                            recipientId: event.recipient?.id || '',
                            message: event.message.text || '[Attachment]',
                            timestamp: new Date(event.timestamp || Date.now()).toISOString(),
                            platform: 'instagram',
                            read: false,
                        };
                        await storeWebhookMessage(msg);

                        // Trigger the Automated Instagram Chatbot asynchronously
                        // We must await here in serverless environments to prevent the process from being killed
                        if (event.message.text) {
                            try {
                                const { processInstagramMessage } = await import('@/lib/instagram-bot');
                                await processInstagramMessage(msg.senderId, event.message.text).catch(err => {
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
            // WhatsApp Cloud API messages
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.value && change.value.messages) {
                        const phoneNumberId = change.value.metadata?.phone_number_id;
                        const contacts = change.value.contacts || [];
                        
                        for (const message of change.value.messages) {
                            if (message.type) {
                                // Find sender name if available
                                const contact = contacts.find((c: any) => c.wa_id === message.from);
                                const senderName = contact?.profile?.name;
                                
                                let ts = message.timestamp ? parseInt(message.timestamp.toString()) : Date.now();
                                if (ts < 100000000000) ts *= 1000; // Convert seconds to milliseconds if needed

                                // Extract message content or use placeholder for media
                                let content = `[${message.type.charAt(0).toUpperCase() + message.type.slice(1)} Message]`;
                                if (message.type === 'text' && message.text?.body) {
                                    content = message.text.body;
                                }

                                const msg: StoredWebhookMessage = {
                                    id: message.id || `wa-${Date.now()}`,
                                    senderId: message.from, // WhatsApp uses phone number as senderId
                                    senderName: senderName,
                                    recipientId: phoneNumberId,
                                    message: content,
                                    timestamp: new Date(ts).toISOString(),
                                    platform: 'whatsapp',
                                    read: false,
                                };
                                await storeWebhookMessage(msg);

                                // Trigger WhatsApp Bot asynchronously only for text messages
                                if (message.type === 'text' && message.text?.body) {
                                    try {
                                        const { processWhatsAppMessage } = await import('@/lib/whatsapp-bot');
                                        await processWhatsAppMessage(msg.senderId, phoneNumberId, message.text.body, senderName).catch(err => {
                                            console.error('[MetaWebhook] WhatsApp background processing error:', err);
                                        });
                                    } catch (err) {
                                        console.error('[MetaWebhook] Failed to import/run wa-bot:', err);
                                    }
                                }
                            }
                        }
                    }
                }
            }
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
