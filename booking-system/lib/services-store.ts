import { clinics as initialClinics, Clinic, Service, Medicine, medicineCatalog as initialMedicines, Supplier, initialSuppliers, PurchaseRecord, PurchaseLineItem, initialPurchases, DistributionRecord, RegisteredProduct, initialRegisteredProducts } from './data';

// In-memory store for services (cloned from initial data)
// We keep the clinic structure to maintain relationships
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));

// In-memory store for medicines
let medicineStore: Medicine[] = JSON.parse(JSON.stringify(initialMedicines));

export const MedicineStore = {
    getMedicines: (): Medicine[] => {
        return medicineStore;
    },

    getMedicine: (id: string): Medicine | undefined => {
        return medicineStore.find(m => m.id === id);
    },

    addMedicine: (medicine: Omit<Medicine, 'id'>): Medicine => {
        const newMedicine: Medicine = {
            ...medicine,
            id: `med-${Date.now()}`
        };
        medicineStore.push(newMedicine);
        return newMedicine;
    },

    updateMedicine: (id: string, updates: Partial<Omit<Medicine, 'id'>>): Medicine | null => {
        const index = medicineStore.findIndex(m => m.id === id);
        if (index === -1) return null;
        medicineStore[index] = { ...medicineStore[index], ...updates };
        return medicineStore[index];
    },

    removeMedicine: (id: string): boolean => {
        const initialLength = medicineStore.length;
        medicineStore = medicineStore.filter(m => m.id !== id);
        return medicineStore.length < initialLength;
    },

    // Deduct stock from a specific branch
    deductStock: (id: string, qty: number = 1, clinicId?: string): boolean => {
        const med = medicineStore.find(m => m.id === id);
        if (!med) return false;
        if (clinicId) {
            const branch = med.branchStock.find(b => b.clinicId === clinicId);
            if (!branch || branch.quantity < qty) return false;
            branch.quantity -= qty;
            return true;
        }
        // Fallback: deduct from central if no clinicId
        if (med.centralStock < qty) return false;
        med.centralStock -= qty;
        return true;
    },

    // Add stock to central warehouse (used by purchases)
    addCentralStock: (id: string, qty: number): boolean => {
        const med = medicineStore.find(m => m.id === id);
        if (!med) return false;
        med.centralStock += qty;
        return true;
    },

    // Distribute stock from central to a branch
    distributeStock: (medicineId: string, clinicId: string, qty: number): boolean => {
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med || med.centralStock < qty) return false;
        med.centralStock -= qty;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        if (branch) {
            branch.quantity += qty;
        } else {
            med.branchStock.push({ clinicId, quantity: qty });
        }
        return true;
    },

    // Get stock for a specific branch
    getBranchStock: (medicineId: string, clinicId: string): number => {
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med) return 0;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        return branch?.quantity || 0;
    },

    // Get total stock across all branches + central
    getTotalStock: (medicineId: string): number => {
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med) return 0;
        return med.centralStock + med.branchStock.reduce((sum, b) => sum + b.quantity, 0);
    },

    // Transfer stock from one branch to another
    transferBranchStock: (medicineId: string, fromClinicId: string, toClinicId: string, qty: number): boolean => {
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med) return false;
        const fromBranch = med.branchStock.find(b => b.clinicId === fromClinicId);
        if (!fromBranch || fromBranch.quantity < qty) return false;
        fromBranch.quantity -= qty;
        const toBranch = med.branchStock.find(b => b.clinicId === toClinicId);
        if (toBranch) {
            toBranch.quantity += qty;
        } else {
            med.branchStock.push({ clinicId: toClinicId, quantity: qty });
        }
        return true;
    }
};

// In-memory store for distribution records
let distributionStore: DistributionRecord[] = [];

export const DistributionStore = {
    getAll: (): DistributionRecord[] => distributionStore,

    getByFilters: (filters: { medicineId?: string; clinicId?: string }): DistributionRecord[] => {
        return distributionStore.filter(d => {
            if (filters.medicineId && d.medicineId !== filters.medicineId) return false;
            if (filters.clinicId && d.toClinicId !== filters.clinicId && d.fromClinicId !== filters.clinicId) return false;
            return true;
        });
    },

    add: (record: Omit<DistributionRecord, 'id'>): DistributionRecord | null => {
        let success: boolean;
        if (record.fromClinicId) {
            // Branch-to-branch transfer
            success = MedicineStore.transferBranchStock(record.medicineId, record.fromClinicId, record.toClinicId, record.quantity);
        } else {
            // Central-to-branch distribution
            success = MedicineStore.distributeStock(record.medicineId, record.toClinicId, record.quantity);
        }
        if (!success) return null;
        const newRecord: DistributionRecord = { ...record, id: `dist-${Date.now()}` };
        distributionStore.push(newRecord);
        return newRecord;
    }
};

// In-memory store for suppliers
let supplierStore: Supplier[] = JSON.parse(JSON.stringify(initialSuppliers));

export const SupplierStore = {
    getAll: (): Supplier[] => supplierStore,

    getById: (id: string): Supplier | undefined => supplierStore.find(s => s.id === id),

    add: (supplier: Omit<Supplier, 'id'>): Supplier => {
        const newSupplier: Supplier = { ...supplier, id: `sup-${Date.now()}` };
        supplierStore.push(newSupplier);
        return newSupplier;
    },

    update: (id: string, updates: Partial<Omit<Supplier, 'id'>>): Supplier | null => {
        const index = supplierStore.findIndex(s => s.id === id);
        if (index === -1) return null;
        supplierStore[index] = { ...supplierStore[index], ...updates };
        return supplierStore[index];
    },

    remove: (id: string): boolean => {
        const len = supplierStore.length;
        supplierStore = supplierStore.filter(s => s.id !== id);
        return supplierStore.length < len;
    }
};

// In-memory store for purchase records
let purchaseStore: PurchaseRecord[] = JSON.parse(JSON.stringify(initialPurchases));

export const PurchaseStore = {
    getAll: (): PurchaseRecord[] => purchaseStore,

    getByFilters: (filters: { medicineId?: string; supplierId?: string }): PurchaseRecord[] => {
        return purchaseStore.filter(p => {
            if (filters.supplierId && p.supplierId !== filters.supplierId) return false;
            if (filters.medicineId && !p.items.some(item => item.medicineId === filters.medicineId)) return false;
            return true;
        });
    },

    add: (record: Omit<PurchaseRecord, 'id'>): PurchaseRecord => {
        const newRecord: PurchaseRecord = { ...record, id: `pur-${Date.now()}` };
        purchaseStore.push(newRecord);
        // Auto-increase central warehouse stock for each line item
        for (const item of newRecord.items) {
            const totalQty = item.quantity + (item.focQuantity || 0);
            MedicineStore.addCentralStock(item.medicineId, totalQty);
        }
        return newRecord;
    },

    remove: (id: string): boolean => {
        const len = purchaseStore.length;
        purchaseStore = purchaseStore.filter(p => p.id !== id);
        return purchaseStore.length < len;
    }
};

export const ServicesStore = {
    // Get all clinics with their services (optionally filtered)
    getClinics: () => {
        return clinicStore;
    },

    // Get specific clinic
    getClinic: (clinicId: string) => {
        return clinicStore.find(c => c.id === clinicId);
    },

    getServiceById: (serviceId: string) => {
        for (const clinic of clinicStore) {
            for (const dept of clinic.departments) {
                const service = dept.services.find(s => s.id === serviceId);
                if (service) return service;
            }
        }
        return null;
    },

    // Add a service to a specific department in a clinic
    addService: (clinicId: string, departmentId: string, service: Omit<Service, 'id'>) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newService: Service = {
            ...service,
            isTaxable: service.isTaxable || false, // Added line
            id: `${departmentId}-svc-${Date.now()}`, // Unique ID
            screeningQuestions: service.screeningQuestions || []
        };

        department.services.push(newService);
        return newService;
    },

    // Remove a service
    removeService: (clinicId: string, departmentId: string, serviceId: string) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return false;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return false;

        const initialLength = department.services.length;
        department.services = department.services.filter(s => s.id !== serviceId);

        return department.services.length < initialLength;
    },

    // Update a service
    updateService: (clinicId: string, departmentId: string, serviceId: string, updates: Partial<Omit<Service, 'id'>>) => {
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const serviceIndex = department.services.findIndex(s => s.id === serviceId);
        if (serviceIndex === -1) return null;

        const updatedService = { ...department.services[serviceIndex], ...updates };
        department.services[serviceIndex] = updatedService;

        return updatedService;
    }
};

// In-memory store for registered products
let registeredProductStore: RegisteredProduct[] = JSON.parse(JSON.stringify(initialRegisteredProducts));

export const RegisteredProductStore = {
    getAll: (): RegisteredProduct[] => registeredProductStore,

    getById: (id: string): RegisteredProduct | undefined => registeredProductStore.find(p => p.id === id),

    add: (product: Omit<RegisteredProduct, 'id'>): RegisteredProduct => {
        const newProduct: RegisteredProduct = { ...product, id: `rp-${Date.now()}` };
        registeredProductStore.push(newProduct);
        return newProduct;
    },

    update: (id: string, updates: Partial<Omit<RegisteredProduct, 'id'>>): RegisteredProduct | null => {
        const index = registeredProductStore.findIndex(p => p.id === id);
        if (index === -1) return null;
        registeredProductStore[index] = { ...registeredProductStore[index], ...updates };
        return registeredProductStore[index];
    },

    remove: (id: string): boolean => {
        const len = registeredProductStore.length;
        registeredProductStore = registeredProductStore.filter(p => p.id !== id);
        return registeredProductStore.length < len;
    }
};
