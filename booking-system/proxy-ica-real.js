const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = 9694;

const server = http.createServer((req, res) => {
    // Enable CORS for all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET') {
        console.log(`[Proxy] Forwarding request to physical toolkit: ${req.url}`);
        
        const options = {
            hostname: '127.0.0.1',
            port: 9004,
            path: req.url,
            method: 'GET',
            rejectUnauthorized: false, // Bypass the certificate validation
            servername: 'toolkitagent.mohre.gov.ae', // Required SNI
            // Allow extremely old TLS versions often used by enterprise/government local services
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
            minVersion: 'TLSv1',
            ciphers: 'ALL:@SECLEVEL=0' // Lower security level to allow weak ciphers
        };

        const proxyReq = https.request(options, (proxyRes) => {
            console.log(`[Proxy] Received response from Toolkit: ${proxyRes.statusCode}`);
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
    console.log(`🚀 ICA Toolkit LEGACY Proxy Server is running on port ${PORT}`);
    console.log(`======================================================`);
    console.log(`\nThis proxy bypasses the SSL certificate and TLS version issues of the physical reader.`);
    console.log(`It connects to the real physical EIDAToolkitService.exe and returns the REAL card data!`);
    console.log(`Keep this window open while reading the Emirates ID.\n`);
});
