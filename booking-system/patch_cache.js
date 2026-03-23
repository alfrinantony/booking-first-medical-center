const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = [
    'app/api/admin/services/route.ts',
    'app/api/admin/drafts/route.ts',
    'app/api/admin/doctors/route.ts',
    'app/api/admin/inventory/route.ts',
    'app/api/admin/medicines/route.ts',
    'app/api/admin/registered-products/route.ts',
    'app/api/admin/suppliers/route.ts'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('fetchCache')) {
        content = content.replace(/export const dynamic = 'force-dynamic';/, "export const dynamic = 'force-dynamic';\nexport const fetchCache = 'force-no-store';");
        fs.writeFileSync(file, content);
        console.log(`Patched ${file}`);
    }
}
