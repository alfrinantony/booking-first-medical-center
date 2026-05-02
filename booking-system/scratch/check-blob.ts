import { loadFromBlob } from './lib/blob-persistence';
async function test() {
    const s = await loadFromBlob('services', null);
    console.log('Services from Azure Blob:', s ? Object.keys(s).length : 0);
    const u = await loadFromBlob('adminUsers', null);
    console.log('AdminUsers from Azure Blob:', u ? Object.keys(u).length : 0);
}
test();
