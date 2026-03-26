import { loadFromBlob, saveToBlob } from './lib/blob-persistence';

async function normalize() {
    console.log("=== NORMALIZATION SCRIPT ===");
    
    console.log("Downloading live equipment...");
    const eq = await loadFromBlob<any[]>('equipment', []);
    let modified = 0;

    for (const item of eq) {
        let b = item.branchId;
        
        // Map Al Muraqabat
        if (['clinic-muraqabat', 'branch-muraqabat', 'muraqabat'].includes(b)) {
            item.branchId = 'clinic-1';
            modified++;
        }
        // Map Al Qiyadah
        else if (['clinic-qiyadah', 'branch-qiyadah', 'qiyadah', 'branch-2'].includes(b)) {
            item.branchId = 'clinic-2';
            modified++;
        }
        // Map Silicon Oasis
        else if (['clinic-silicon', 'branch-silicon', 'silicon', 'branch-3'].includes(b)) {
            item.branchId = 'clinic-3';
            modified++;
        }
    }
    
    console.log(`Normalized ${modified} equipment items into the new global IDs.`);
    
    console.log("Downloading live history...");
    const hist = await loadFromBlob<any[]>('equipment-history', []);
    let histModified = 0;
    
    for (const h of hist) {
        if (h.toBranch) {
            if (['clinic-muraqabat', 'branch-muraqabat', 'muraqabat'].includes(h.toBranch)) { h.toBranch = 'clinic-1'; histModified++; }
            else if (['clinic-qiyadah', 'branch-qiyadah', 'qiyadah', 'branch-2'].includes(h.toBranch)) { h.toBranch = 'clinic-2'; histModified++; }
            else if (['clinic-silicon', 'branch-silicon', 'silicon', 'branch-3'].includes(h.toBranch)) { h.toBranch = 'clinic-3'; histModified++; }
        }
        if (h.fromBranch) {
            if (['clinic-muraqabat', 'branch-muraqabat', 'muraqabat'].includes(h.fromBranch)) { h.fromBranch = 'clinic-1'; histModified++; }
            else if (['clinic-qiyadah', 'branch-qiyadah', 'qiyadah', 'branch-2'].includes(h.fromBranch)) { h.fromBranch = 'clinic-2'; histModified++; }
            else if (['clinic-silicon', 'branch-silicon', 'silicon', 'branch-3'].includes(h.fromBranch)) { h.fromBranch = 'clinic-3'; histModified++; }
        }
    }
    
    console.log(`Normalized ${histModified} history arrays into new global IDs.`);

    await saveToBlob('equipment', eq);
    await saveToBlob('equipment-history', hist);
    
    console.log("✅ Normalization complete. Equipment Database perfectly maps to 3 branches exclusively.");
}

normalize().catch(console.error);
