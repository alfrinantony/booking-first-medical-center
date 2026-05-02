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
    
    console.log('Testing .it getUserToken ...');
    try {
        const token = await callRpc('https://user-api.simplybook.it/login', 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]);
        console.log('.it Token:', token);
    } catch(e) { console.error('.it Error:', e); }

    console.log('Testing .me getUserToken ...');
    try {
        const token2 = await callRpc('https://user-api.simplybook.me/login', 'getUserToken', [COMPANY, ADMIN_LOGIN, ADMIN_PASSWORD]);
        console.log('.me Token:', token2);
    } catch(e) { console.error('.me Error:', e); }
}
test().catch(console.error);
