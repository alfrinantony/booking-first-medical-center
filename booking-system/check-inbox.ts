import { loadFromBlob } from './lib/blob-persistence';
async function main() {
  const data = await loadFromBlob<{ messages: any[] }>('webhook-messages', { messages: [] });
  console.log('Webhook Messages Count:', data.messages.length);
  const ig = data.messages.filter(m => m.platform === 'instagram');
  console.log('IG Webhook Messages:', ig.length);
  if (ig.length > 0) {
     console.log('Latest IG Message:', ig[ig.length - 1]);
  }
}
main().catch(console.error);
