import { loadFromBlob } from './lib/blob-persistence';
async function main() {
  const data = await loadFromBlob<{ messages: any[] }>('webhook-messages', { messages: [] });
  console.log('Webhook Messages Count:', data.messages.length);
  const nonIg = data.messages.filter(m => m.platform !== 'instagram');
  console.log('Non-IG Webhook Messages:', nonIg.length);
  if (nonIg.length > 0) {
     console.log('Non-IG Messages:', JSON.stringify(nonIg, null, 2));
  }
}
main().catch(console.error);
