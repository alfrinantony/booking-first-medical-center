import { loadFromBlob, saveToBlob } from '../lib/blob-persistence';

async function run() {
    console.log('loading...');
    const records = await loadFromBlob('simplybook-bookings', []);
    console.log('loaded', records.length);
    const filtered = records.filter((r: any) => r.paymentStatus !== 'error' && r.payment_status !== 'error' && r.status !== 'error');
    console.log('filtered down to', filtered.length);
    
    // Also log the Elvira records specifically
    const elvira = records.filter((r: any) => r.clientName && r.clientName.includes('Elvira'));
    console.log('Elvira records count:', elvira.length);
    for (const e of elvira) {
        console.log(e.sbId, e.date, e.time, e.paymentStatus, e.status);
    }
    
    await saveToBlob('simplybook-bookings', filtered);
    console.log('saved!');
}

run().catch(console.error);
