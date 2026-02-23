
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

const modes = ['streaming', 'interactive', 'realtime', 'avatar', 'default', 'rtc', 'webrtc', 'chat'];

async function testMode(mode) {
    return new Promise((resolve) => {
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
            res.on('data', c => data += c);
            res.on('end', () => {
                resolve({ mode, status: res.statusCode, body: data.toString() });
            });
        });

        req.on('error', () => resolve({ mode, error: true }));
        req.write(JSON.stringify({ mode: mode }));
        req.end();
    });
}

(async () => {
    console.log('Testing modes:', modes);
    for (const mode of modes) {
        const result = await testMode(mode);
        console.log(`\nMode: "${mode}" -> Status: ${result.status}`);
        console.log(`Response: ${result.body}`);

        // If status is NOT 422 with the same error, we found something interesting
        if (result.status !== 422) {
            console.log('!!! INTERESTING RESULT !!!');
        } else if (!result.body.includes("discriminator 'mode'")) {
            console.log('!!! VALID MODE FOUND (different error) !!!');
        }
    }
})();
