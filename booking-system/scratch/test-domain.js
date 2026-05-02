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
    const API_KEY = '6688b526d9f4598cba7aa85987b94ac42fe68772b459e06626e3b583017ecfa2';
    
    console.log('Testing .it ...');
    try {
        const token = await callRpc('https://user-api.simplybook.it/login', 'getToken', [COMPANY, API_KEY]);
        console.log('.it Token:', token);
    } catch(e) { console.error('.it Error:', e); }

    console.log('Testing .me ...');
    try {
        const token2 = await callRpc('https://user-api.simplybook.me/login', 'getToken', [COMPANY, API_KEY]);
        console.log('.me Token:', token2);
    } catch(e) { console.error('.me Error:', e); }
}
test().catch(console.error);
