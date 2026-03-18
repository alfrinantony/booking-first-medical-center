import { ServicesStore } from './lib/services-store.js';
import { clinicStore, Clinic } from './lib/data.js';

async function test() {
    console.log('Testing Add Service across 2 branches...');
    
    // Simulate what the frontend does
    // 1. Initial clinics logic
    const clinics = await ServicesStore.getClinics();
    const branch1 = clinics.find(c => c.name === 'Al Muraqabat Branch');
    const branch2 = clinics.find(c => c.name === 'Al Qiyadah Branch');
    const branch3 = clinics.find(c => c.name === 'Silicon Oasis Branch');
    
    console.log('Found branches:', branch1?.id, branch2?.id, branch3?.id);
    
    // 2. We add a service to branch1 and branch2
    const sourceClinic = branch1;
    const sourceDept = sourceClinic?.departments[0];
    
    const targetDeptId = branch2?.departments?.find(d => d.name === sourceDept?.name)?.id || '';
    
    console.log('Adding to Branch 1 Dept:', sourceDept?.id);
    console.log('Adding to Branch 2 Dept:', targetDeptId);
    
    const newService = {
        name: 'Test Cross-Branch Service',
        description: 'Test',
        price: 100,
        duration: 30,
        isTaxable: false
    };
    
    const res1 = await ServicesStore.addService(branch1.id, sourceDept.id, newService);
    const res2 = await ServicesStore.addService(branch2.id, targetDeptId, newService);
    
    console.log('Results of ADD:', res1?.name, res2?.name);
    
    // 3. Now let's try evaluating `previouslyAssignedBranchIds` 
    // This is exactly what the frontend does in openEditModal
    const branchesWithService = [];
    const clinicsAfterAdd = await ServicesStore.getClinics();
    for (const clinic of clinicsAfterAdd) {
        for (const dept of clinic.departments || []) {
            if ((dept.services || []).some(s => s.name === 'Test Cross-Branch Service')) {
                branchesWithService.push(clinic.id);
                break;
            }
        }
    }
    console.log('Branches with this service AFTER ADD:', branchesWithService);
    
    // 4. Update service: remove from branch 2, leave in branch 1
    console.log('--- Now simulating EDIT: removing from branch 2... ---');
    const targetBranchIds = [branch1.id]; // We unchecked branch 2
    const branchesToRemove = branchesWithService.filter(id => !targetBranchIds.includes(id));
    console.log('Branches to remove:', branchesToRemove); // Should be [branch2.id]
    
    for (const branchId of branchesToRemove) {
        const branchClinic = clinicsAfterAdd.find(c => c.id === branchId);
        for (const dept of branchClinic.departments || []) {
            const found = (dept.services || []).find(s => s.name === 'Test Cross-Branch Service');
            if (found) {
                console.log(`Removing from ${branchId} dept ${dept.id} service ${found.id}`);
                const success = await ServicesStore.removeService(branchId, dept.id, found.id);
                console.log('Remove success:', success);
            }
        }
    }
    
    // 5. Final validation
    const branchesAtEnd = [];
    const clinicsAtEnd = await ServicesStore.getClinics();
    for (const clinic of clinicsAtEnd) {
        for (const dept of clinic.departments || []) {
            if ((dept.services || []).some(s => s.name === 'Test Cross-Branch Service')) {
                branchesAtEnd.push(clinic.id);
                break;
            }
        }
    }
    console.log('Branches with this service AFTER EDIT:', branchesAtEnd);
}

test().catch(console.error);
