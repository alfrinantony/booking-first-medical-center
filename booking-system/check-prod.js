const { BlobServiceClient } = require('@azure/storage-blob');
const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
async function main() {
  if (!connStr) { console.log('NO CONN STR'); return; }
  const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  const containerClient = blobServiceClient.getContainerClient('fmc-data');
  const blobClient = containerClient.getBlockBlobClient('webhook-messages.json');
  if (!(await blobClient.exists())) {
     console.log('Blob does not exist!'); return;
  }
  const downloadResponse = await blobClient.download(0);
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
     chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  const data = JSON.parse(body);
  const wa = data.messages.filter(x => x.platform === 'whatsapp');
  console.log(`Total WA messages: ${wa.length}`);
  if (wa.length > 0) {
      console.log('Last 2 WA messages:');
      console.log(JSON.stringify(wa.slice(-2), null, 2));
  }
}
main().catch(console.error);
