import 'dotenv/config';
import { sendWhatsAppMessage } from './lib/whatsapp-bot';

async function test() {
    console.log('Testing sending WhatsApp message...');
    await sendWhatsAppMessage('971564343999', '518094511384485', 'Test Auto Reply with System User Token');
    console.log('Done testing sendWhatsAppMessage');
}
test().catch(console.error);
