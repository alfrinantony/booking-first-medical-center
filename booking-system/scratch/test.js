async function test() {
    try {
        console.log('Testing migrate...');
        const res = await fetch('http://localhost:3000/api/admin/simplybook?migrate=true&from=2026-04-01&to=2026-05-31');
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch(e) { console.error(e); }
}
test();
