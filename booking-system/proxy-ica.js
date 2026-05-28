const http = require('http');
const https = require('https');

const PORT = 9694;

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET') {
        console.log(`[Proxy] Forwarding request: ${req.url}`);
        
        const options = {
            hostname: '127.0.0.1',
            port: 9004,
            path: req.url,
            method: 'GET',
            rejectUnauthorized: false, // Bypass the certificate validation!
            servername: 'toolkitagent.mohre.gov.ae' // REQUIRED by ICA Toolkit to prevent SNI error
        };

        const proxyReq = https.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
            console.error(`[Proxy] Error: ${e.message}`);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        });

        proxyReq.end();
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 ICA Toolkit Proxy Server is running on port ${PORT}`);
    console.log(`======================================================`);
    console.log(`\nThis proxy bypasses the SSL certificate issues of the ICA Toolkit.`);
    console.log(`The web application will now connect successfully via HTTP!`);
    console.log(`Keep this window open while reading the Emirates ID.\n`);
});
