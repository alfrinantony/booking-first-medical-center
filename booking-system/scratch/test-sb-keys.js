async function callRpc(url, method, params, headers = {}) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const data = await res.json();
    if (data.error) throw data.error;
    return data.result;
}

async function test() {
    const COMPANY = 'firstmedicalcenter';
    const ADMIN_LOGIN = 'dubaifmcapi';
    const ADMIN_PASSWORD = 'NewPassword2';
    
    console.log('Getting user token...');
    const token = await callRpc('https://user-api.simplybook.me/login', 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]);

    const headers = { 'X-Company-Login': COMPANY, 'X-User-Token': token };
    
    console.log('Getting admin booking for 236832...');
    try {
        const details = await callRpc('https://user-api.simplybook.me/admin/', 'getBooking', ['236832'], headers);
        console.log('Details:', details);
    } catch(e) {
        console.error('Error:', e);
    }
}
test().catch(console.error);
