async function test() {
    try {
        console.log('Testing live debug-pg API...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/debug-pg');
        console.log('Status:', res.status, (await res.text()).substring(0, 1500));
    } catch (e) { console.error(e); }
}
test();
