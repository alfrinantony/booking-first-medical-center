const fs = require('fs');
let content = fs.readFileSync('lib/bookings-store.ts', 'utf8');
content = content.replace(/\0/g, '');
content = content.replace(/\/\/ trigger deploy\s*$/i, '');
fs.writeFileSync('lib/bookings-store.ts', content, 'utf8');
