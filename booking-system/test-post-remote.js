const https = require('https');

const postData = JSON.stringify({
    clinicId: 'test',
    deptId: 'test',
    doctorId: 'test',
    serviceId: 'test',
    date: '2026-06-20',
    slot: '10:00 AM',
    patientName: 'Test Patient',
    patientPhone: '1234567890',
    amount: 100,
});

const req = https.request({
    hostname: 'ai.dubaifmc.com',
    port: 443,
    path: '/api/admin/bookings',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
}, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log(`BODY: ${body}`));
});

req.on('error', (e) => console.error(`problem with request: ${e.message}`));
req.write(postData);
req.end();
