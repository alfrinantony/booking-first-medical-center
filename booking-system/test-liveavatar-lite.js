
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
                console.log(`\nTesting mode: ${mode}`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                resolve();
            });
        });

        req.on('error', console.error);
        req.write(JSON.stringify({ mode: mode }));
        req.end();
    });
}

(async () => {
    await testMode('LITE');
    await testMode('FULL');
})();
