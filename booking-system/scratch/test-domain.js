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
    const SECRET_KEY = 'cf487a3b9a23c350b2b203af878b0c529ac936aac3b35e8232769d3aaa3b59b6';
    
    console.log('Getting token with getToken and API_KEY...');
    const token = await callRpc('https://user-api.simplybook.it/login', 'getToken', [COMPANY, API_KEY]);
    console.log('Token:', token);

    console.log('Calling getBookings on ADMIN endpoint...');
    try {
        const headers = { 'X-Company-Login': COMPANY, 'X-User-Token': token };
        const res = await callRpc('https://user-api.simplybook.it/admin/', 'getBookings', [{ date_from: '2026-04-20', date_to: '2026-05-10' }, 500, 0], headers);
        console.log('Success!', Object.keys(res).length);
    } catch (e) {
        console.error('Error on ADMIN:', e);
    }
}
test().catch(console.error);
