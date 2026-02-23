
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
} catch (error) { console.error(error); }

if (!apiKey) {
    console.error('API Key not found');
    process.exit(1);
}

const options = {
    hostname: 'api.liveavatar.com',
    path: '/v1/sessions/token',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Body:', data.toString());
    });
});

req.write(JSON.stringify({})); // Empty body
req.end();
