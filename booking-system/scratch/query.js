
async function run() {
    const res = await fetch('https://ai.dubaifmc.com/api/admin/bookings');
    const bookings = await res.json();
    console.log(bookings.slice(0, 5).map(b => ({id: b.id, status: b.status, history: b.statusHistory})));
}
run();

