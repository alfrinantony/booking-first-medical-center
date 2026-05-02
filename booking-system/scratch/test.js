async function test() {
    try {
        console.log('Testing debug API...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/debug-sb');
        console.log('Status:', res.status, (await res.text()).substring(0, 1000));
    } catch(e) { console.error(e); }
}
test();
