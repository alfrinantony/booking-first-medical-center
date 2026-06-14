"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialRegisteredProducts = exports.initialPurchases = exports.initialSuppliers = exports.medicineCatalog = exports.timeSlots = exports.clinics = exports.BOOKING_CATEGORIES = exports.initialCallAgentSummaries = exports.initialBranchContracts = void 0;
exports.initialBranchContracts = [];
exports.initialCallAgentSummaries = [];
// Specific services for Dermatology & Aesthetics
const dermatologyServices = [
    { id: 'derm-svc-0', name: 'Pico Laser', category: 'Face Care', price: 499, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-1', name: 'RF Micro Needling', category: 'Face Care', price: 499, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-2', name: 'CO2 Fractional Laser', category: 'Face Care', price: 499, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-3', name: 'Subcision', category: 'Face Care', price: 499, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-4', name: 'Tattoo Removal', category: 'Face Care', price: 299, duration: 15, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-5', name: 'Wart Removal', category: 'Face Care', price: 399, duration: 15, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-6', name: 'Chemical Peeling', category: 'Face Care', price: 399, duration: 30, followUpDuration: 7, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-7', name: 'Double Chin Reduction', category: 'Face Care', price: 399, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-8', name: 'Spider Treatment', category: 'Face Care', price: 499, duration: 15, followUpDuration: 7, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-9', name: 'PRP Microneedling', category: 'Face Care', price: 199, duration: 30, followUpDuration: 0, allowedGender: 'both', isTaxable: true },
    { id: 'derm-svc-10', name: 'PRP Injection', category: 'Face Care', price: 299, duration: 30, followUpDuration: 7, allowedGender: 'both', isTaxable: true },
];
// Helper to generate services
const generateServices = (deptName) => {
    if (deptName === 'Aesthetic Dermatology')
        return dermatologyServices;
    return Array.from({ length: 10 }).map((_, i) => ({
        id: `${deptName}-svc-${i}`,
        name: `${deptName} Service ${i + 1}`,
        price: 50 + (i * 10), // Deterministic price
        duration: [15, 30, 45, 60][i % 4], // Multiples of 15 mins
    }));
};
// Helper to generate doctors
const generateDoctors = (deptName, count) => {
    return Array.from({ length: count }).map((_, i) => ({
        id: `${deptName}-doc-${i}`,
        name: `Dr. ${deptName} Specialist ${i + 1}`,
        specialty: deptName,
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${deptName}${i}`,
        // Make the first doctor of every department "High Capacity" for testing
        maxConcurrentBookings: i === 0 ? 2 : 1
    }));
};
// Customer-facing booking categories (ordered for display)
exports.BOOKING_CATEGORIES = [
    'Laser Hair Removal',
    'Face Care',
    'Hair Care',
    'Body Care',
    'Fillers and Botox',
    'Injectables',
    'Weight Reduction',
    'Clinical Dermatology',
    'IV Fluids',
    'Piercings',
];
// Data Generation
const departmentNames = [
    'Aesthetic Dermatology',
    'Nursing-Hair Removal',
    'Nursing-Beauty Therapy',
    'Physiotherapy'
];
exports.clinics = [
    {
        id: 'clinic-1',
        name: 'Al Muraqabat Branch',
        address: '7th Floor, Dominos Pizza Building, Al Muraqabat St, Deira, Dubai',
        locationMap: 'https://maps.app.goo.gl/Dov2FNfRXj14o9zE6',
        coordinates: { lat: 25.269550, lng: 55.325580 }, // Approx for distance calc
        cid: '7431063405124527074', // Decimal CID
        vatPercentage: 5, // 5% VAT
        rating: 4.8,
        reviewCount: 2336,
        parkingInfo: 'Free Parking on Basement',
        contactPhone: '+971 4 250 6262',
        email: 'muraqabat@firstmedical.ae',
        operationHours: 'Mon–Sat: 10 AM – 10 PM',
        rooms: [
            { id: 'c1-rec-1', name: 'Reception 1', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-crash-1', name: 'Emergency Crash Cart 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-con-1', name: 'Consultation Room 1', type: 'Consultation', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-con-2', name: 'Consultation Room 2', type: 'Consultation', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-las-1', name: 'Laser Hair Removal Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-las-2', name: 'Laser Hair Removal Room 2', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-las-3', name: 'Laser Hair Removal Room 3', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-las-4', name: 'Laser Hair Removal Room 4', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-las-5', name: 'Laser Hair Removal Room 5', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-hyd-1', name: 'Hydrafacial Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-hyd-2', name: 'Hydrafacial Room 2', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-tx-1', name: 'Treatment Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-prep-1', name: 'Preparation Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-prep-2', name: 'Preparation Room 2', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-ster-1', name: 'Sterilisation Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-it-1', name: 'IT Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-waste-1', name: 'Medical Waste Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-toilet-f', name: 'Female Toilet', type: 'Restroom', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-toilet-m', name: 'Male Toilet', type: 'Restroom', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-pantry-1', name: 'Pantry', type: 'Staff', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-admin-1', name: 'Administration Room', type: 'Staff', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-wait-m', name: 'Male Waiting Area', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c1-wait-f', name: 'Female Waiting Area', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] }
        ],
        departments: departmentNames.map(dept => ({
            id: `c1-${dept}`,
            name: dept,
            services: generateServices(dept),
            doctors: generateDoctors(dept, 5), // 4 depts * 5 docs = 20 total
        }))
    },
    {
        id: 'clinic-2',
        name: 'Al Qiyadah Branch',
        address: 'Mamzar Center, Opposite to Qiyadah Metro, Abu Hail, Dubai',
        locationMap: 'https://maps.app.goo.gl/hLxF8p6jZzUFjGdw6?g_st=aw',
        coordinates: { lat: 25.279760, lng: 55.346980 }, // Approx for distance calc
        cid: '6599779727377220868', // Decimal CID
        vatPercentage: 5, // 5% VAT
        rating: 4.9,
        reviewCount: 1936,
        parkingInfo: 'Ample RTA Parking',
        contactPhone: '+971 4 261 7171',
        email: 'qiyadah@firstmedical.ae',
        operationHours: 'Mon–Sat: 10 AM – 10 PM',
        rooms: [
            { id: 'c2-rec-1', name: 'Reception 1', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-crash-1', name: 'Emergency Crash Cart 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-con-1', name: 'Consultation Room 1', type: 'Consultation', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-con-2', name: 'Consultation Room 2', type: 'Consultation', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-phys-1', name: 'Physiotherapy Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-elec-1', name: 'Electrolysis Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-1', name: 'Laser Hair Removal Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-2', name: 'Laser Hair Removal Room 2', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-3', name: 'Laser Hair Removal Room 3', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-4', name: 'Laser Hair Removal Room 4', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-5', name: 'Laser Hair Removal Room 5', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-las-6', name: 'Laser Hair Removal Room 6', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-hyd-1', name: 'Hydrafacial Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-hyd-2', name: 'Hydrafacial Room 2', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-tx-1', name: 'Treatment Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-proc-1', name: 'Procedure Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-ster-1', name: 'Sterilisation Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-dis-1', name: 'Disinfectant Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-it-1', name: 'IT Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-staff-1', name: 'Staff Lounge', type: 'Staff', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-waste-1', name: 'Medical Waste Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-hk-1', name: 'Housekeeping Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-toilet-f', name: 'Female Toilet', type: 'Restroom', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-toilet-m', name: 'Male Toilet', type: 'Restroom', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-wait-m', name: 'Male Waiting Area', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c2-wait-f', name: 'Female Waiting Area', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] }
        ],
        departments: departmentNames.map(dept => ({
            id: `c2-${dept}`,
            name: dept,
            services: generateServices(dept),
            doctors: generateDoctors(dept, 5), // 4 depts * 5 docs = 20 total
        }))
    },
    {
        id: 'clinic-3',
        name: 'Silicon Oasis Branch',
        address: '15th Floor, SIT Tower, Silicon Oasis, Dubai',
        locationMap: 'https://maps.app.goo.gl/wUUv2iQiFxaWSVL69?g_st=aw',
        coordinates: { lat: 25.123840, lng: 55.370250 }, // Approx for distance calc
        cid: '13746671430218161081', // Unsigned Decimal CID for 0xbec5fcd5322a1bb9
        vatPercentage: 5, // 5% VAT
        rating: 4.8,
        reviewCount: 178,
        parkingInfo: 'Building Parking 30 min Free',
        contactPhone: '+971 4 392 0809',
        email: 'siliconoasis@firstmedical.ae',
        operationHours: 'Mon–Sat: 10 AM – 10 PM',
        rooms: [
            { id: 'c3-rec-1', name: 'Reception 1', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-crash-1', name: 'Emergency Crash Cart 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-con-1', name: 'Consultation Room 1', type: 'Consultation', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-las-1', name: 'Laser Hair Removal Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-tx-1', name: 'Treatment Room 1', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-prep-1', name: 'Procedure & Vital Signs Room', type: 'Procedure', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-ster-1', name: 'Clean Utility Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-dis-1', name: 'Dirty Utility Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-it-1', name: 'Store Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-staff-1', name: 'Medical Waste Room', type: 'Utility', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-wait-1', name: 'Waiting Area', type: 'Waiting', assignedEquipmentIds: [], requiredMedicineIds: [] },
            { id: 'c3-pantry-1', name: 'Pantry', type: 'Staff', assignedEquipmentIds: [], requiredMedicineIds: [] }
        ],
        departments: departmentNames.map(dept => ({
            id: `c3-${dept}`,
            name: dept,
            services: generateServices(dept),
            doctors: generateDoctors(dept, 5), // 4 depts * 5 docs = 20 total
        }))
    },
];
// Generate 15-minute intervals from 10:00 AM to 10:00 PM
exports.timeSlots = (() => {
    const slots = [];
    let hour = 10;
    let minute = 0;
    while (hour < 22) { // Until 10 PM
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;
        const displayMinute = minute === 0 ? '00' : minute;
        slots.push(`${String(displayHour).padStart(2, '0')}:${displayMinute} ${period}`);
        minute += 15;
        if (minute === 60) {
            minute = 0;
            hour++;
        }
    }
    return slots;
})();
// Medicine Catalog
exports.medicineCatalog = [
    { id: 'med-1', name: 'Hyaluronic Acid Serum', price: 149, centralStock: 20, branchStock: [{ clinicId: 'clinic-1', quantity: 15 }, { clinicId: 'clinic-2', quantity: 10 }, { clinicId: 'clinic-3', quantity: 5 }], expiryDate: '2027-06-15', category: 'medicine', registeredProductId: 'rp-1' },
    { id: 'med-2', name: 'Vitamin C Brightening Cream', price: 99, centralStock: 10, branchStock: [{ clinicId: 'clinic-1', quantity: 10 }, { clinicId: 'clinic-2', quantity: 8 }, { clinicId: 'clinic-3', quantity: 7 }], expiryDate: '2027-03-01', category: 'medicine', registeredProductId: 'rp-2' },
    { id: 'med-3', name: 'Retinol Night Cream', price: 199, centralStock: 5, branchStock: [{ clinicId: 'clinic-1', quantity: 6 }, { clinicId: 'clinic-2', quantity: 5 }, { clinicId: 'clinic-3', quantity: 4 }], expiryDate: '2026-12-31', category: 'medicine' },
    { id: 'med-4', name: 'Sunscreen SPF 50+', price: 79, centralStock: 40, branchStock: [{ clinicId: 'clinic-1', quantity: 25 }, { clinicId: 'clinic-2', quantity: 20 }, { clinicId: 'clinic-3', quantity: 15 }], expiryDate: '2028-01-15', category: 'medicine' },
    { id: 'med-5', name: 'Collagen Boosting Mask', price: 129, centralStock: 3, branchStock: [{ clinicId: 'clinic-1', quantity: 5 }, { clinicId: 'clinic-2', quantity: 4 }, { clinicId: 'clinic-3', quantity: 3 }], expiryDate: '2026-08-20', category: 'consumable' },
    { id: 'med-6', name: 'Anti-Scar Gel', price: 89, centralStock: 15, branchStock: [{ clinicId: 'clinic-1', quantity: 10 }, { clinicId: 'clinic-2', quantity: 8 }, { clinicId: 'clinic-3', quantity: 7 }], expiryDate: '2027-09-10', category: 'medicine' },
    { id: 'med-7', name: 'Post-Procedure Recovery Kit', price: 249, centralStock: 2, branchStock: [{ clinicId: 'clinic-1', quantity: 3 }, { clinicId: 'clinic-2', quantity: 3 }, { clinicId: 'clinic-3', quantity: 2 }], expiryDate: '2026-11-30', category: 'consumable' },
    { id: 'med-8', name: 'Numbing Cream (Topical)', price: 59, centralStock: 20, branchStock: [{ clinicId: 'clinic-1', quantity: 15 }, { clinicId: 'clinic-2', quantity: 15 }, { clinicId: 'clinic-3', quantity: 10 }], expiryDate: '2027-05-01', category: 'consumable' },
    { id: 'med-9', name: 'Sterile Gauze Pads (50pk)', price: 25, centralStock: 80, branchStock: [{ clinicId: 'clinic-1', quantity: 50 }, { clinicId: 'clinic-2', quantity: 40 }, { clinicId: 'clinic-3', quantity: 30 }], expiryDate: '2029-01-01', category: 'consumable' },
    { id: 'med-10', name: 'Disposable Syringes (20pk)', price: 35, centralStock: 60, branchStock: [{ clinicId: 'clinic-1', quantity: 40 }, { clinicId: 'clinic-2', quantity: 30 }, { clinicId: 'clinic-3', quantity: 20 }], expiryDate: '2028-06-30', category: 'consumable' },
    { id: 'med-11', name: 'Antiseptic Solution 500ml', price: 45, centralStock: 30, branchStock: [{ clinicId: 'clinic-1', quantity: 20 }, { clinicId: 'clinic-2', quantity: 15 }, { clinicId: 'clinic-3', quantity: 15 }], expiryDate: '2027-12-15', category: 'consumable' },
];
exports.initialSuppliers = [
    { id: 'sup-1', name: 'DUBEMED TR LLC', tradeLicenseExpiry: '31/12/2025', bankName: 'AL MASRAF BANK OF THE RAK', iban: 'AE080500000242730580001', trn: '100442724100003' },
    { id: 'sup-2', name: 'DUBEMED DRUG STORE LLC', contactPerson: 'Ziad', phone: '97136781577', companyNumber: '97125341456', faxNumber: '97141234568', address: 'Drug Store #G-023, The Curve Building, SZRoad', tradeLicenseNumber: '0516', tradeLicenseExpiry: '31/12/2025', bankName: 'DUBAI COMMERCIAL BANK', iban: 'AE080500010017631793000', trn: '100442524200003' },
    { id: 'sup-3', name: 'AL MORAD TRADING LLC', contactPerson: 'Ally', phone: '97150528269', companyNumber: '971444243817', faxNumber: '97141234567', address: 'Near Fish Roundabout, Deira, Dubai', tradeLicenseNumber: '12618', tradeLicenseExpiry: '31/12/2025', bankName: 'DUBAI COMMERCIAL BANK', trn: '100442524200003' },
    { id: 'sup-4', name: 'MEDCO MEDICAL SUPPLIES LLC', contactPerson: 'Sally', faxNumber: '97141234567', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-5', name: 'CUTEC COSMETICS TRADING LLC', contactPerson: 'Amy Ibrahim', phone: '97150744158', companyNumber: '97542418880', faxNumber: '97141234567', address: '7, Al Riqqa, Bldg', tradeLicenseExpiry: '31/12/2025', bankName: 'SHARJAH ISLAMIC BANK', trn: '100442524200003' },
    { id: 'sup-6', name: 'LIFECARE MEDICAL EQUIPMENT TR LLC', tradeLicenseExpiry: '31/12/2025', bankName: 'EMIRATES ISLAMIC BANK', trn: '100442524200003' },
    { id: 'sup-7', name: 'PROCKIMA DRUG STORE LLC', contactPerson: 'Adel', phone: '971542978495', email: 'info@prockimadrugstore.com', address: 'Near to Claris Mall, Sh. Zayed Rd, Dubai', tradeLicenseExpiry: '31/12/2025', bankName: 'MASHREQ BANK' },
    { id: 'sup-8', name: 'MULLA CEMENT HOUSE', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-9', name: 'SHARJAH SURGICAL ARTS AND ANTIQUITIES TRADING LLC', address: 'Deira, Dubai', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-10', name: 'BEADS MEDICAL EQUIPMENT TRADING LLC', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-11', name: 'SHINING MEDICAL / LONDON FORT MANUFACTURING LLC', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-12', name: 'SOUTHEND DRUG STORE', contactPerson: 'Kim', phone: '97165', companyNumber: '97165173576', faxNumber: '97141234567', email: 'sdspharmacy26@gmail.com', address: 'International City, Dubai', tradeLicenseExpiry: '31/12/2025', bankName: 'MASHREQ BANK' },
    { id: 'sup-13', name: 'MUO WAY LLC', contactPerson: 'Ameer', phone: '971501731376', faxNumber: '97141234567', address: '603, Dubai Science Park North Tower', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-14', name: 'AL SAHA CLINIC', contactPerson: 'Majed/Abdullatif', phone: '97148aborq', email: 'info@alsahaclinic.ae', address: 'The villa', tradeLicenseExpiry: '31/12/2025', bankName: 'National Bank of the Al-Khaimah', iban: 'AE010400000318803880001' },
    { id: 'sup-15', name: 'NAJAR COSMETICS CO LLC', address: '181 um sugiim street, industrial', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-16', name: 'JARSA GENERAL TRADING LLC', contactPerson: 'Abdullah Wala', phone: '971568051510', faxNumber: '97141234567', address: 'Dubai, Al Quoz, Polimer St', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-17', name: 'SAFE PRINTING MEDICAL EQUIPMENTS LLC', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-18', name: 'CITY PHARMACY LLC', contactPerson: 'Sarvar', phone: '971503490170', faxNumber: '97141234567', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-19', name: 'MAGENTA RX COMPOUNDING PHARMACY LLC', contactPerson: 'Mariam', phone: '971504819825', faxNumber: '97141234567', tradeLicenseExpiry: '31/12/2025' },
    { id: 'sup-20', name: 'AHMED KHALIL AL BAKER MEDICAL SUPPLIES LLC', contactPerson: 'Ahmed', phone: '971504823052', companyNumber: '97542853251', faxNumber: '97141234567', address: 'PO.BOX1188, Dubai-UAE', tradeLicenseExpiry: '31/12/2026', iban: 'AE475211000000172163001' },
];
exports.initialPurchases = [
    {
        id: 'pur-1', supplierId: 'sup-1', billNumber: 'INV-2026-001', purchaseDate: '2026-01-15',
        items: [
            { medicineId: 'med-1', quantity: 50, unitPrice: 110, focQuantity: 5, batchNumber: 'BT-A001', expiryDate: '2027-06-30' },
        ],
        subtotal: 5500, taxAmount: 275, totalAmount: 5775,
        chequeNumber: 'CHQ-1001', chequeDate: '2026-02-15'
    },
    {
        id: 'pur-2', supplierId: 'sup-2', billNumber: 'INV-2026-012', purchaseDate: '2026-02-01',
        items: [
            { medicineId: 'med-4', quantity: 60, unitPrice: 60, focQuantity: 5, batchNumber: 'BT-B012', expiryDate: '2027-12-31' },
            { medicineId: 'med-5', quantity: 40, unitPrice: 60, focQuantity: 5, batchNumber: 'BT-B013', expiryDate: '2027-11-30' },
        ],
        subtotal: 6000, taxAmount: 300, totalAmount: 6300,
        chequeNumber: 'CHQ-1015', chequeDate: '2026-03-01'
    },
    {
        id: 'pur-3', supplierId: 'sup-3', billNumber: 'INV-2026-019', purchaseDate: '2026-02-10',
        items: [
            { medicineId: 'med-9', quantity: 200, unitPrice: 17.5, focQuantity: 0, batchNumber: 'BT-C019', expiryDate: '2028-03-15' },
        ],
        subtotal: 3500, taxAmount: 0, totalAmount: 3500
    },
];
exports.initialRegisteredProducts = [
    {
        id: 'rp-1', tradeName: 'Botulinum Toxin Type A', genericName: 'Botulinum Toxin', itemCode: 'BTX-001',
        registeredPrice: 1200, category: 'medicine', purchaseUnit: 'Box', storedType: 'Vial',
        numberOfStoredType: 1, consumableItemsInside: 100, consumableUnit: 'units',
        registrationBody: 'MOH', registrationNumber: 'MOH-DRG-2024-0451',
        registrationExpiry: '2027-12-31',
        registeredSupplierId: 'sup-1', registeredSupplierIds: ['sup-1', 'sup-2'], // Test with multiple
        registeredSubAgent: 'Allergan ME', linkedMedicineId: 'med-1', minCentralStock: 5
    },
    {
        id: 'rp-2', tradeName: 'Juvederm Ultra Plus XC', genericName: 'Hyaluronic Acid Filler', itemCode: 'JUV-002',
        registeredPrice: 850, category: 'medicine', purchaseUnit: 'Box', storedType: 'Prefilled Syringe',
        numberOfStoredType: 2, consumableItemsInside: 2, consumableUnit: 'ml',
        registrationBody: 'DHA', registrationNumber: 'DHA-MED-2025-1120',
        registrationExpiry: '2028-06-30', registeredSupplierId: 'sup-2', registeredSupplierIds: ['sup-2'],
        registeredSubAgent: 'AbbVie Gulf', linkedMedicineId: 'med-2', minCentralStock: 10
    },
    {
        id: 'rp-3', tradeName: 'Adrenaline 1mg/ml Injection', genericName: 'Epinephrine', itemCode: 'ADR-003',
        registeredPrice: 45, category: 'em_medicine', purchaseUnit: 'Pack', storedType: 'Vial',
        numberOfStoredType: 10, consumableItemsInside: 10, consumableUnit: 'ml',
        registrationBody: 'MOH', registrationNumber: 'MOH-EM-2024-0089',
        registrationExpiry: '2027-03-15', registeredSupplierId: 'sup-3', registeredSupplierIds: ['sup-3'], minCentralStock: 20
    },
    {
        id: 'rp-4', tradeName: 'Retinoid Cream 0.05%', genericName: 'Tretinoin', itemCode: 'RET-004',
        registeredPrice: 65, category: 'medicine', purchaseUnit: 'Box', storedType: 'Packet',
        numberOfStoredType: 12, consumableItemsInside: 12, consumableUnit: 'tubes',
        registrationBody: 'DHA', registrationNumber: 'DHA-COS-2023-0332',
        registrationExpiry: '2025-01-31', registeredSupplierId: 'sup-1', registeredSupplierIds: ['sup-1', 'sup-4', 'sup-5'],
        registeredSubAgent: 'Pharma Solutions LLC'
    },
];
