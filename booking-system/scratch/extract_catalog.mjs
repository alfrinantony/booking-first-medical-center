import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const csvPath = 'imports/2026_Booking Report.csv';
const csvData = fs.readFileSync(csvPath, 'utf8');

const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
});

const services = new Map();
const providers = new Set();
const categories = new Set();

records.forEach(record => {
    const serviceName = record['Service']?.trim();
    const providerName = record['Service provider']?.trim();
    const category = record['Service category']?.trim();
    const priceStr = record['Price']?.trim();
    const timeStr = record['Time']?.trim(); // e.g. "02:00 PM - 03:00 PM"
    
    if (providerName) {
        providers.add(providerName);
    }
    
    if (serviceName && category) {
        categories.add(category);
        
        if (!services.has(serviceName)) {
            let duration = 30; // default
            if (timeStr && timeStr.includes('-')) {
                const parts = timeStr.split('-');
                const parseTime = (t) => {
                    const [time, period] = t.trim().split(' ');
                    let [h, m] = time.split(':').map(Number);
                    if (period === 'PM' && h !== 12) h += 12;
                    if (period === 'AM' && h === 12) h = 0;
                    return h * 60 + m;
                };
                try {
                    const startMin = parseTime(parts[0]);
                    const endMin = parseTime(parts[1]);
                    duration = endMin - startMin;
                } catch (e) {}
            }
            
            services.set(serviceName, {
                name: serviceName,
                category: category,
                price: parseFloat(priceStr) || 0,
                duration: duration > 0 ? duration : 30
            });
        }
    }
});

console.log('--- Categories ---');
console.log(Array.from(categories).join(', '));

console.log('\n--- Providers (Doctors) ---');
console.log(Array.from(providers).join(', '));

console.log('\n--- Services Sample (First 10) ---');
console.log(Array.from(services.values()).slice(0, 10));

console.log('\n--- Total Services ---');
console.log(services.size);

// Save to a json file for easier reference
fs.writeFileSync('scratch/catalog.json', JSON.stringify({
    categories: Array.from(categories),
    providers: Array.from(providers),
    services: Array.from(services.values())
}, null, 2));

console.log('Saved to scratch/catalog.json');
