import http from 'http';

const data = JSON.stringify({
    invoiceCategory: 'clinic_single',
    clientName: 'Test Client',
    clientPhone: '123456789',
    items: [{ description: 'Consultation', quantity: 1, unitPrice: 100, total: 100, consumptions: [] }],
    subtotal: 100,
    taxPercentage: 5,
    taxAmount: 5,
    totalAmount: 105,
    paymentMethod: 'card',
    paymentConfirmed: true,
    generatedBy: 'Admin',
    date: '2026-03-29'
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/billing',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, res => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', responseData));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
