import { loadFromBlob } from './lib/blob-persistence';

async function check() {
    const data = await loadFromBlob<any>('packages', { customerPackages: [] });
    const cp = data.customerPackages || [];
    console.log("TOTAL CUSTOMER PACKAGES:", cp.length);
    const target = cp.filter((p: any) => p.customerPhone.replace(/\D/g, '') === '971554556492');
    console.log("MATCHING TARGET PHONE (971554556492):", target.length);
    target.forEach((p: any) => {
        console.log(`- ID: ${p.id} | Name: ${p.packageName}`);
        console.log(`  Phone: '${p.customerPhone}' | Active: ${p.active} | Expiry: ${p.expiryDate}`);
        console.log(`  Payment: ${p.paymentMethod} | Status: ${p.paymentStatus}`);
    });
}

check().catch(console.error);
