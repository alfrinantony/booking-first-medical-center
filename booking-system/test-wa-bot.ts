import 'dotenv/config';
import crypto from 'crypto';

async function test() {
    const token = process.env.META_PAGE_ACCESS_TOKEN || '';
    const appSecret = process.env.META_APP_SECRET || '';
    const resolvedPhoneNumberId = '518094511384485';
    const recipientPhone = '971564343999';
    
    let url = `https://graph.facebook.com/v21.0/${resolvedPhoneNumberId}/messages`;
    if (appSecret) {
        const appSecretProof = crypto.createHmac('sha256', appSecret).update(token).digest('hex');
        url += `?appsecret_proof=${appSecretProof}`;
    }

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: { preview_url: false, body: 'Test Auto Reply with App Secret Proof' }
    };

    console.log('Sending to', url);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    console.log(await res.text());
}
test().catch(console.error);
