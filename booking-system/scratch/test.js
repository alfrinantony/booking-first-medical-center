async function test() {
    try {
        console.log('Testing live bookings API...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/bookings');
        console.log('Status:', res.status, (await res.text()).substring(0, 500));
    } catch(e) { console.error(e); }
}
test();
