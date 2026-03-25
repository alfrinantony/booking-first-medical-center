const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr) {
    console.error('No AZURE_STORAGE_CONNECTION_STRING found in .env.local');
    process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
const containerClient = blobServiceClient.getContainerClient('fmc-data');

async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

async function load(key) {
    const blobClient = containerClient.getBlockBlobClient(`${key}.json`);
    if (!(await blobClient.exists())) return null;
    const downloadResponse = await blobClient.download(0);
    const body = await streamToString(downloadResponse.readableStreamBody);
    return JSON.parse(body);
}

async function save(key, data) {
    const blobClient = containerClient.getBlockBlobClient(`${key}.json`);
    const content = JSON.stringify(data, null, 2);
    await blobClient.uploadData(Buffer.from(content, 'utf-8'), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    console.log(`Saved ${key}.json`);
}

async function main() {
    const clinics = await load('clinics');
    if (!clinics) {
        console.log('No clinics blob found');
        return;
    }

    const targetDepts = [
        'Aesthetic Dermatology',
        'Nursing-Hair Removal',
        'Nursing-Beauty Therapy',
        'Physiotherapy'
    ];

    const departmentMap = {
        'Laser Hair Removal': 'Nursing-Hair Removal',
        'Hair Removal': 'Nursing-Hair Removal',
        'Nursing-Laser Hair Removal': 'Nursing-Hair Removal',
        'Orthopedics': 'Physiotherapy',
        'Pediatrics': 'Physiotherapy',
        'Gynecology': 'Physiotherapy',
        'Ophthalmology': 'Physiotherapy',
        'General Medicine': 'Aesthetic Dermatology',
    };

    const prefixMap = {
        'clinic-1': 'c1',
        'clinic-2': 'c2',
        'clinic-3': 'c3'
    };

    const newDeptIdMapping = {}; // map of oldDeptId to newDeptId

    for (const clinic of clinics) {
        const prefix = prefixMap[clinic.id] || clinic.id;
        const newDeptsMap = new Map();

        for (const t of targetDepts) {
            newDeptsMap.set(t, { id: `${prefix}-${t}`, name: t, services: [], doctors: [] });
        }

        console.log(`\nMigrating clinic: ${clinic.name}`);
        for (const d of clinic.departments || []) {
            let newName = departmentMap[d.name] || d.name;
            if (!targetDepts.includes(newName)) {
                newName = 'Aesthetic Dermatology'; 
            }
            
            console.log(`Mapped old dept '${d.name}' -> '${newName}'`);

            const targetDept = newDeptsMap.get(newName);
            newDeptIdMapping[d.id] = targetDept.id;

            for (const s of d.services || []) {
                if (!targetDept.services.find(ts => ts.name === s.name)) {
                    targetDept.services.push(s);
                }
            }
            for (const doc of d.doctors || []) {
                if (!targetDept.doctors.find(td => td.id === doc.id)) {
                    doc.departmentName = newName;
                    targetDept.doctors.push(doc);
                }
            }
        }
        clinic.departments = Array.from(newDeptsMap.values());
    }

    await save('clinics', clinics);

    // Migrate bookings
    const bookings = await load('bookings');
    if (bookings) {
        let changed = false;
        for (const b of bookings) {
            if (newDeptIdMapping[b.deptId]) {
                if (b.deptId !== newDeptIdMapping[b.deptId]) {
                    b.deptId = newDeptIdMapping[b.deptId];
                    changed = true;
                }
            } else {
                // Ensure deptId matches one of the new ones
                const clinic = clinics.find(c => c.id === b.clinicId);
                if (clinic && !clinic.departments.find(d => d.id === b.deptId)) {
                    b.deptId = clinic.departments[0].id;
                    changed = true;
                }
            }
        }
        if (changed) {
            await save('bookings', bookings);
        } else {
            console.log('No booking changes needed');
        }
    }

    console.log('Migration complete');
}

main().catch(console.error);
