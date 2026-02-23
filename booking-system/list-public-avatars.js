
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
    path: '/v1/avatars?type=shared', // trying 'shared' or 'public' or just relying on defaults
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
        console.log('Response:', data);
    });
});

req.on('error', console.error);
req.end();
