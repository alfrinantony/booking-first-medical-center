async function test() {
    console.log("Fetching clinics...");
    const res = await fetch('http://localhost:3000/api/admin/services?t=' + Date.now(), { cache: 'no-store' });
    const clinics = await res.json();
    
    const clinic = clinics[0];
    const dept1 = clinic.departments[0];
    const dept2 = clinic.departments[1];

    const service = dept1.services[0];
    console.log("Found service:", service.name, "in", dept1.name);

    // MOCK: User edits service and adds it to dept2.
    // The frontend sends a POST for the new dept.
    const payload = {
        clinicId: clinic.id,
        departmentId: dept2.id,
        serviceId: service.id, // passing original ID
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        allowedDoctorIds: service.allowedDoctorIds || [],
        allowedGender: service.allowedGender || 'both',
        allowedDays: service.allowedDays || [],
        isTaxable: service.isTaxable || false,
        category: service.category || '',
        screeningQuestions: service.screeningQuestions || [],
        requiredResourceIds: service.requiredResourceIds || [],
        medicineIds: service.medicineIds || [],
        consumableIds: service.consumableIds || [],
        productConsumptions: service.productConsumptions || [],
        addOns: service.addOns || []
    };

    console.log("Sending POST for dept2...");
    const postRes = await fetch('http://localhost:3000/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    console.log("POST Status:", postRes.status);
    const postData = await postRes.text();
    console.log("POST Data:", postData);

    // MOCK: User unchecked dept1. Send DELETE.
    console.log("Sending DELETE for dept1...");
    const delRes = await fetch(`http://localhost:3000/api/admin/services?clinicId=${clinic.id}&departmentId=${dept1.id}&serviceId=${service.id}`, {
        method: 'DELETE'
    });
    console.log("DELETE Status:", delRes.status);
    const delData = await delRes.text();
    console.log("DELETE Data:", delData);

    // Verify it stuck:
    const res2 = await fetch('http://localhost:3000/api/admin/services?t=' + Date.now(), { cache: 'no-store' });
    const clinics2 = await res2.json();
    const d1 = clinics2[0].departments[0];
    const d2 = clinics2[0].departments[1];

    console.log("Did it get removed from dept1?", !d1.services.find(s => s.id === service.id));
    console.log("Did it get added to dept2?", !!d2.services.find(s => s.id === service.id));
}

test().catch(console.error);
