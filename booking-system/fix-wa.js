const { BlobServiceClient } = require('@azure/storage-blob');
const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const client = BlobServiceClient.fromConnectionString(connectionString).getContainerClient('fmc-data');

async function fix() {
    try {
        const blob = client.getBlobClient('webhook-messages.json');
        const buf = await blob.downloadToBuffer();
        const data = JSON.parse(buf.toString('utf-8'));
        let fixed = 0;
        data.messages.forEach(m => {
            if (m.platform === 'whatsapp' && m.timestamp.startsWith('1970-')) {
                // Recover approximate date for old messages so they appear in inbox
                m.timestamp = new Date().toISOString();
                fixed++;
            }
        });
        if (fixed > 0) {
            const content = JSON.stringify(data, null, 2);
            await client.getBlockBlobClient('webhook-messages.json').upload(content, content.length);
            console.log('Fixed ' + fixed + ' messages in Azure blob.');
        } else {
            console.log('No 1970 messages found to fix.');
        }
    } catch(e) { console.error('Error:', e.message); }
}
fix();
