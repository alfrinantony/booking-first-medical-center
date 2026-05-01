async function runLocalSyncAndMigrate() {
    try {
        console.log('1. Checking local /api/admin/bookings...');
        const bRes = await fetch('http://localhost:3000/api/admin/bookings');
        console.log('Bookings status:', bRes.status);

        console.log('2. Running SimplyBook migration (April to May)...');
        // Let's do a 30-day range to catch recent ones
        const mRes = await fetch('http://localhost:3000/api/admin/simplybook?migrate=true&from=2026-04-01&to=2026-05-31');
        const text = await mRes.text();
        console.log('Migrate status:', mRes.status, text.substring(0, 100));
    } catch(e) { console.error(e); }
}
runLocalSyncAndMigrate();
