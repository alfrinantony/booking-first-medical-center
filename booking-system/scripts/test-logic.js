const fs = require('fs');

async function test() {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const client = BlobServiceClient.fromConnectionString(conn).getContainerClient('fmc-data').getBlockBlobClient('clinics.json');
    const b = await client.downloadToBuffer();
    const clinics = JSON.parse(b.toString());

    // Mock handling of add/remove
    const clinic = clinics[0];
    const sourceDept = clinic.departments[0];
    const targetDept = clinic.departments[1];

    const service = sourceDept.services[0];
    if (!service) {
        console.log("No services available");
        return;
    }
    console.log("Found service:", service.name, "in dept", sourceDept.name);

    // Mock POST (Add to target)
    targetDept.services.push({
        ...service,
        id: service.id
    });
    console.log("Added to target, target has", targetDept.services.length, "services");

    // Mock DELETE (Remove from source)
    const initialLen = sourceDept.services.length;
    sourceDept.services = sourceDept.services.filter(s => s.id !== service.id);
    console.log("Removed from source, length went from", initialLen, "to", sourceDept.services.length);

    console.log("Service ID was:", service.id);
    
    // Now verify the serviceMap aggregation logic
    const rawServices = clinic.departments.flatMap(dept =>
        dept.services.map(s => ({ ...s, _deptId: dept.id, _deptName: dept.name }))
    );

    const serviceMap = new Map();
    for (const s of rawServices) {
        if (!serviceMap.has(s.id)) {
            serviceMap.set(s.id, { ...s, _deptNames: [s._deptName], _deptIds: [s._deptId] });
        } else {
            const existing = serviceMap.get(s.id);
            if (!existing._deptIds.includes(s._deptId)) {
                existing._deptNames.push(s._deptName);
                existing._deptIds.push(s._deptId);
            }
        }
    }
    
    const allServices = Array.from(serviceMap.values());
    const moved = allServices.find(s => s.id === service.id);
    console.log("Aggregated moved service depts:", moved._deptNames);
}

test().catch(console.error);
