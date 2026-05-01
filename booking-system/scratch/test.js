const COMPANY = 'firstmedicalcenter';
const ADMIN_LOGIN = 'dubaifmcapi';
const ADMIN_PASSWORD = 'NewPassword2';

async function rpcCall(endpoint, method, params) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const text = await res.text();
    console.log(`[${method}] status=${res.status} response=${text.substring(0, 100)}...`);
    try {
        return JSON.parse(text);
    } catch(e) {
        return { error: text };
    }
}

async function test() {
    const tokenRes = await rpcCall('https://user-api.simplybook.me/login', 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]);
    if (tokenRes.result) {
        const token = tokenRes.result;
        
        console.log('Testing getBookings on ADMIN endpoint...');
        const adminRes = await fetch('https://user-api.simplybook.me/admin/', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Company-Login': COMPANY,
                'X-User-Token': token
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBookings', params: [{ date_from: '2026-05-01', date_to: '2026-05-30' }, 10, 0] })
        });
        console.log('[Admin getBookings]', (await adminRes.text()).substring(0, 500));
    }
}

test();
