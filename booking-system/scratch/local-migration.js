const { BlobServiceClient } = require('@azure/storage-blob');
const https = require('https');

const connectionString = 'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/';
const containerName = 'fmc-data';

if (!connectionString) {
    console.error('Missing AZURE_STORAGE_CONNECTION_STRING in .env.local');
    process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

async function loadBlob(blobName) {
    const blobClient = containerClient.getBlobClient(blobName);
    try {
        const downloadBlockBlobResponse = await blobClient.download(0);
        const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
        return JSON.parse(downloaded);
    } catch (err) {
        if (err.statusCode === 404) return [];
        throw err;
    }
}

async function saveBlob(blobName, data) {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const content = JSON.stringify(data);
    await blockBlobClient.upload(content, content.length);
}

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data.toString());
        });
        readableStream.on('end', () => {
            resolve(chunks.join(''));
        });
        readableStream.on('error', reject);
    });
}

function buildMonthlyChunks(startYear, startMonth, startDay) {
    const chunks = [];
    const today = new Date();
    let cursor = new Date(`${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}T00:00:00Z`);

    while (cursor <= today) {
        const from = cursor.toISOString().split('T')[0];
        const nextCursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const endOfMonth = new Date(nextCursor.getTime() - 24 * 60 * 60 * 1000);
        const toDate = endOfMonth <= today ? endOfMonth : today;
        const to = toDate.toISOString().split('T')[0];
        chunks.push({ from, to });
        cursor = nextCursor;
    }
    return chunks;
}

function fetchChunk(from, to) {
    return new Promise((resolve, reject) => {
        // Use skip_save=true to skip Azure Blob on the server, ensuring it never 504s!
        const url = `https://ai.dubaifmc.com/api/admin/simplybook?migrate=true&from=${from}&to=${to}&skip_invoices=true&skip_save=true`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch(e) {
                        reject(new Error(`Failed to parse JSON: ${e.message} - ${data.substring(0,200)}`));
                    }
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('Loading existing bookings from Azure Blob locally...');
    let bookings = await loadBlob('bookings.json');
    console.log(`Loaded ${bookings.length} existing bookings.`);
    
    let simplybookBookings = await loadBlob('simplybook-bookings.json');
    
    // We start from Sept 1, 2022 because before that was fully successfully migrated
    const chunks = buildMonthlyChunks(2022, 9, 1);
    console.log(`Starting migration for ${chunks.length} monthly chunks using skip_save=true...`);
    
    let totalMigrated = 0;
    
    for (const chunk of chunks) {
        process.stdout.write(`Processing: ${chunk.from} to ${chunk.to}... `);
        
        let success = false;
        let retries = 3;
        
        while (!success && retries > 0) {
            try {
                const result = await fetchChunk(chunk.from, chunk.to);
                
                if (!result.ok) {
                     throw new Error(result.error || 'Unknown error');
                }
                
                const newRecords = result.records || [];
                
                // Append to bookings
                const existingIds = new Set(bookings.filter(r => r.source === 'simplybook').map(r => r.sbId));
                const filtered = bookings.filter(r => r.source !== 'simplybook' || !existingIds.has(r.sbId));
                bookings = [...filtered, ...newRecords];
                bookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                totalMigrated += newRecords.length;
                console.log(`SUCCESS (${newRecords.length} records fetched)`);
                success = true;
            } catch (err) {
                retries--;
                console.log(`FAILED: ${err.message}. Retries left: ${retries}`);
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`Saving ${bookings.length} bookings to Azure Blob...`);
    await saveBlob('bookings.json', bookings);
    console.log(`DONE! Total migrated in this run: ${totalMigrated}`);
}

run();
