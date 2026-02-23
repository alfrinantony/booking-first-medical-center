
const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper to safely load env vars
function loadEnv() {
    const vars = {};
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split(/\r?\n/);
            lines.forEach(line => {
                const trimmedLine = line.trim();
                // Ignore comments and empty lines
                if (!trimmedLine || trimmedLine.startsWith('#')) return;

                // Handle key=value format safely
                const match = trimmedLine.match(/^([^=]+)=(.*)$/);
                if (match) {
                    vars[match[1].trim()] = match[2].trim();
                }
            });
        }
    } catch (error) { console.error('Error loading .env.local:', error); }
    return vars;
}

const env = loadEnv();
const apiKey = env.LIVEAVATAR_API_KEY;
const mode = env.LIVEAVATAR_MODE || 'LITE';
const avatarId = env.LIVEAVATAR_AVATAR_ID;

if (!apiKey) { console.error('Error: LIVEAVATAR_API_KEY not found'); process.exit(1); }
if (!avatarId || avatarId === 'CHANGE_ME') { console.error('Error: LIVEAVATAR_AVATAR_ID not configured'); process.exit(1); }

console.log('--- Configuration ---');
console.log(`API Key: ${apiKey.substring(0, 5)}...`);
console.log(`Mode: ${mode}`);
console.log(`Avatar ID: ${avatarId}`);
console.log('---------------------');

const payload = JSON.stringify({
    mode: mode,
    avatar_id: avatarId
});

const options = {
    hostname: 'api.liveavatar.com',
    path: '/v1/sessions/token',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => { data += chunk; });

    res.on('end', () => {
        const status = res.statusCode;
        console.log(`\nStatus Code: ${status}`);

        try {
            const responseBody = JSON.parse(data);
            console.log('Response Body:', JSON.stringify(responseBody, null, 2));

            if (status >= 200 && status < 300) {
                console.log('\n✅ SUCCESS: Session token retrieved successfully!');
                console.log('The API integration is verified.');
            } else {
                console.log('\n❌ FAILURE: API returned an error.');
                if (status === 401) console.log('Check your API Key.');
                if (status === 422) console.log('Check your Payload (Mode/Avatar ID).');
            }
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Request Error: ${e.message}`);
});

req.write(payload);
req.end();
