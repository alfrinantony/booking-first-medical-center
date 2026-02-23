
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load API Key
let apiKey = '';
try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('LIVEAVATAR_API_KEY=')) {
                apiKey = trimmedLine.split('=')[1].trim();
            }
        });
    }
} catch (error) { }

if (!apiKey) process.exit(1);

const options = {
    hostname: 'api.liveavatar.com',
    path: '/v1/avatars',
    method: 'GET',
    headers: {
        'x-api-key': apiKey
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            // Print succinct list or full dump if small
            if (Array.isArray(json)) {
                console.log(`Found ${json.length} avatars.`);
                if (json.length > 0) console.log('First Avatar:', json[0]);
            } else if (json.data && Array.isArray(json.data)) {
                console.log(`Found ${json.data.length} avatars.`);
                if (json.data.length > 0) console.log('First Avatar:', json.data[0]);
            } else {
                console.log('Response:', data);
            }
        } catch (e) {
            console.log('Response (raw):', data);
        }
    });
});

req.on('error', console.error);
req.end();
