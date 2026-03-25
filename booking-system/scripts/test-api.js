const http = require('http');

const putReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/services',
    method: 'GET'
}, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log(data.slice(0, 500)));
});
putReq.end();
