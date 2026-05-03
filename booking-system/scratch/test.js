async function test() {
    try {
        console.log('Testing live debug-sb API...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/debug-sb');
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text.substring(0, 1000));
    } catch(e) { console.error(e); }
}
test();
