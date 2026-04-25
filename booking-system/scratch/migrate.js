const https = require('https');

function buildDailyChunks(startYear, startMonth, startDay) {
    const chunks = [];
    const today = new Date();
    let cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));

    while (cursor <= today) {
        const from = cursor.toISOString().split('T')[0];
        chunks.push({ from, to: from });
        cursor = new Date(cursor.getTime() + 1 * 24 * 60 * 60 * 1000);
    }
    return chunks;
}

function fetchChunk(from, to) {
    return new Promise((resolve, reject) => {
        // ADDED: &skip_invoices=true to bypass slow invoice fetch
        const url = `https://ai.dubaifmc.com/api/admin/simplybook?migrate=true&from=${from}&to=${to}&skip_invoices=true`;
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
    // We start from Sept 1, 2022
    const chunks = buildDailyChunks(2022, 9, 1);
    console.log(`Starting migration for ${chunks.length} daily chunks with skip_invoices=true...`);
    
    let totalMigrated = 0;
    
    for (const chunk of chunks) {
        process.stdout.write(`Processing: ${chunk.from}... `);
        
        let success = false;
        let retries = 3;
        
        while (!success && retries > 0) {
            try {
                const result = await fetchChunk(chunk.from, chunk.to);
                totalMigrated += result.migrated || 0;
                console.log(`SUCCESS (${result.migrated} migrated)`);
                success = true;
            } catch (err) {
                retries--;
                console.log(`FAILED: ${err.message}. Retries left: ${retries}`);
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\nDONE! Total migrated in this run: ${totalMigrated}`);
}

run();
