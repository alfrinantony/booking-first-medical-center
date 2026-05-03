const fetch = require('node-fetch');

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
    'category-order'
];

async function run() {
    for (const key of keys) {
        console.log(`Migrating ${key}...`);
        try {
            const res = await fetch(`http://localhost:3000/api/admin/debug-sb?key=${key}`);
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
