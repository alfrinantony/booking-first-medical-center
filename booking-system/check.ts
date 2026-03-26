import { loadFromBlob } from './lib/blob-persistence';

async function check() {
    const eq = await loadFromBlob<any[]>('equipment', []);
    const uniqueIds = Array.from(new Set(eq.map((i: any) => i.branchId)));
    console.log("EXACT LIVE BRANCH IDs IN EQUIPMENT.JSON:");
    uniqueIds.forEach(id => console.log(id));
}

check().catch(console.error);
