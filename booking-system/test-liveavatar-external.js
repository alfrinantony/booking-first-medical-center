
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables directly from .env.local
let apiKey = '';
try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const match = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (match && match[1].trim() === 'LIVEAVATAR_API_KEY') {
                apiKey = match[2].trim();
            }
        });
    }
} catch (error) {
    console.error('Error loading .env.local:', error);
}

if (!apiKey) {
    process.exit(1);
}

// Get the single UUID
const halfLength = apiKey.length / 2;
const firstHalf = apiKey.substring(0, halfLength);
let realKey = apiKey;
if (firstHalf === apiKey.substring(halfLength)) {
    realKey = firstHalf;
    console.log('Using single UUID from duplicated key.');
}

function testHeader(headerName, headerValue) {
    return new Promise((resolve) => {
        console.log(`\nTesting with header: ${headerName}`);

        const options = {
            hostname: 'api.liveavatar.com',
            path: '/v1/sessions/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [headerName]: headerValue
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const text = data.toString();
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('SUCCESS!');
                    console.log('Response:', text);
                    resolve(true);
                } else {
                    console.log(`FAILED (Status ${res.statusCode})`);
                    console.log('Response:', text);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(e.message);
            resolve(false);
        });
        req.end();
    });
}

async function runTests() {
    // Test x-api-key
    await testHeader('x-api-key', realKey);
    // Test X-Api-Key (case sensitivity usually doesn't matter but good to be sure)
    // await testHeader('X-Api-Key', realKey);
}

runTests();
