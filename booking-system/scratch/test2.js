
async function test() {
    console.log('Testing PATCH on sb-1gr34r756hf');

    const patchRes = await fetch('https://ai.dubaifmc.com/api/bookings/sb-1gr34r756hf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
    });
    console.log('PATCH returned:', patchRes.status);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));

    // Fetch all bookings
    const res = await fetch('https://ai.dubaifmc.com/api/admin/bookings');
    const bookings = await res.json();
    const bk = bookings.find(x => x.id === 'sb-1gr34r756hf');
    console.log('Fetched status:', bk ? bk.status : 'Not Found');

    // Revert
    await fetch('https://ai.dubaifmc.com/api/bookings/sb-1gr34r756hf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
    });
    console.log('Reverted');
}
test();

