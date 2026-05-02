async function test() {
    try {
        console.log('Testing local webhooks API...');
        const res = await fetch('http://localhost:3000/api/webhooks/simplybook');
        console.log('Status:', res.status, (await res.text()).substring(0, 100));
    } catch(e) { console.error(e); }
}
test();
