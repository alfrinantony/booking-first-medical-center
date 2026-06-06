const https = require('https');

const APP_ID = '1956787038259952';
const APP_SECRET = '91cec59e71b9a9c95636a491e71c6762';

function configureWebhook(accessToken) {
    const postData = new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: 'https://ai.dubaifmc.com/api/webhooks/meta',
        verify_token: 'my_secure_verify_token',
        fields: 'messages',
        access_token: accessToken
    }).toString();

    const options = {
        hostname: 'graph.facebook.com',
        path: `/v21.0/${APP_ID}/subscriptions`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Webhook Config Status: ${res.statusCode}`);
            console.log(`Webhook Config Response: ${data}`);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

https.get(`https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=client_credentials`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) {
            console.log('Got access token, configuring webhook...');
            configureWebhook(parsed.access_token);
        } else {
            console.error('Failed to get access token:', data);
        }
    });
}).on('error', (e) => {
    console.error(`Error fetching token: ${e.message}`);
});
