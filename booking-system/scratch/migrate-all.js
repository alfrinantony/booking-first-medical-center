
const keys = [
    'medicines',
    'registered-products',
    'suppliers',
    'purchases',
    'equipment',
    'resources',
    'category-images',
    'inventory-batches',
    'clinics',
    'category-order',
    'room-checklists',
    'hr-employees',
    'hr-shifts',
    'hr-recruitment',
    'hr-payslips',
    'hr-payslip',
    'hr-letters',
    'hr-leave',
    'hr-eos',
    'hr-documents',
    'hr-calendar',
    'hr-attendance',
    'users',
    'adminUsers',
    'clinician-schedules',
    'stock-transfers',
    'expired-stock',
    'stock-adjustments',
    'distributions'
];

async function run() {
    for (const key of keys) {
        console.log(`Migrating ${key}...`);
        try {
            const res = await fetch(`https://ai.dubaifmc.com/api/admin/debug-sb?key=${key}`);
            const data = await res.json();
            console.log(data);
        } catch (e) {
            console.error(`Error migrating ${key}:`, e.message);
        }
        // Wait 2 seconds between requests to let the connection pool settle
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("All done!");
}

run();
