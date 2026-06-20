async function test() {
    try {
        console.log('Testing live API 500 error response format...');
        const res = await fetch('https://ai.dubaifmc.com/api/bookings/this-id-does-not-exist-at-all-xyz', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch(e) { console.error(e); }
}
test();
