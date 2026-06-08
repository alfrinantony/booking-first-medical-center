const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const connectionString = envConfig.AZURE_STORAGE_CONNECTION_STRING;
const containerName = envConfig.AZURE_STORAGE_CONTAINER || 'fmc-data';

const client = BlobServiceClient.fromConnectionString(connectionString).getContainerClient('fmc-data');

async function updateSettings() {
    try {
        const blob = client.getBlobClient('settings.json');
        const buf = await blob.downloadToBuffer();
        const data = JSON.parse(buf.toString('utf-8'));
        
        console.log("Old messengerAccessToken:", data.settings.messengerAccessToken);
        console.log("Old whatsappAccessToken:", data.settings.whatsappAccessToken);
        console.log("Old metaAppId:", data.settings.metaAppId);

        data.settings.messengerAccessToken = "EAAbzrZCxRCvABRgKD4QBCe0CTPZA4lUuANQDqYfD9YOMz2jxXPrVJjZCdDwGWPouEtQU69Pm51X69rH1kBT7c6c3aKNs0c2qVX1mxV346aKKy884GAbZBlbdmHZALo3fOfBSH9XGxPwIgrW07BgZARERwYQqwB0nv6qztlZBM9K7IAJlJCZCZCVLZAVWenYdASwZBSY7wZDZD";
        data.settings.whatsappAccessToken = "EAAbzrZCxRCvABRkjFsvTM5ZAuqtFcfpGskzt4GIlmwZCX62gfhHKBnY2NSYSzgFxnQbQuXQZC9HaWRle7Qw8COLOZAGZA9ZCaDUEZBuQZAuy2jHLhwcApP59N1aGi1WUyMzLlCoRxtz8ZBcKJnYZAe1R78fSun5dkL1hy22qUbbFPiwLZCZA4LNL3njFyUd7ZBESZBZBsz2TRQZDZD";
        data.settings.metaAppId = "1956787038259952";

        const content = JSON.stringify(data, null, 2);
        await client.getBlockBlobClient('settings.json').upload(content, content.length);
        console.log("Settings successfully updated in Azure Blob.");
    } catch(e) { 
        console.error('Error:', e.message); 
    }
}

updateSettings();
