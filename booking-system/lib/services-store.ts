import { clinics as initialClinics, Clinic, Service, Medicine, medicineCatalog as initialMedicines, Supplier, initialSuppliers, PurchaseRecord, initialPurchases, DistributionRecord, RegisteredProduct, initialRegisteredProducts, InventoryBatch, BranchStockEntry } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

// ── Clinics (shared backing store for Services + Doctors) ─────
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));
let clinicsLoaded = false;

async function ensureClinicsLoaded() {
    if (!clinicsLoaded) {
        clinicStore = await loadFromBlob<Clinic[]>('clinics', clinicStore);
        clinicsLoaded = true;
    }
}

// ── Medicines ─────────────────────────────────────────────────
let medicineStore: Medicine[] = JSON.parse(JSON.stringify(initialMedicines));
let medicinesLoaded = false;

async function ensureMedicinesLoaded() {
    if (!medicinesLoaded) {
        medicineStore = await loadFromBlob<Medicine[]>('medicines', medicineStore);
        medicinesLoaded = true;
    }
}

export const MedicineStore = {
    getMedicines: async (): Promise<Medicine[]> => {
        await ensureMedicinesLoaded();
        return medicineStore;
    },

    getMedicine: async (id: string): Promise<Medicine | undefined> => {
        await ensureMedicinesLoaded();
        return medicineStore.find(m => m.id === id);
    },

    addMedicine: async (medicine: Omit<Medicine, 'id'>): Promise<Medicine> => {
        // NOTE: Manual add is still available internally for purchase-driven creation
        await ensureMedicinesLoaded();
        const newMedicine: Medicine = { ...medicine, id: `med-${Date.now()}` };
        medicineStore.push(newMedicine);
        await saveToBlob('medicines', medicineStore);
        return newMedicine;
    },

    // Internal-only: find medicine by registeredProductId
    findByProductId: async (registeredProductId: string): Promise<Medicine | undefined> => {
        await ensureMedicinesLoaded();
        return medicineStore.find(m => m.registeredProductId === registeredProductId);
    },

    updateMedicine: async (id: string, updates: Partial<Omit<Medicine, 'id'>>): Promise<Medicine | null> => {
        await ensureMedicinesLoaded();
        const index = medicineStore.findIndex(m => m.id === id);
        if (index === -1) return null;
        medicineStore[index] = { ...medicineStore[index], ...updates };
        await saveToBlob('medicines', medicineStore);
        return medicineStore[index];
    },

    removeMedicine: async (id: string): Promise<boolean> => {
        await ensureMedicinesLoaded();
        const initialLength = medicineStore.length;
        medicineStore = medicineStore.filter(m => m.id !== id);
        if (medicineStore.length < initialLength) {
            await saveToBlob('medicines', medicineStore);
            return true;
        }
        return false;
    },

    deductStock: async (id: string, qty: number = 1, clinicId?: string): Promise<boolean> => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === id);
        if (!med) return false;
        if (clinicId) {
            const branch = med.branchStock.find(b => b.clinicId === clinicId);
            if (!branch || branch.quantity < qty) return false;
            branch.quantity -= qty;
        } else {
            if (med.centralStock < qty) return false;
            med.centralStock -= qty;
        }
        await saveToBlob('medicines', medicineStore);
        return true;
    },

    addCentralStock: async (id: string, qty: number): Promise<boolean> => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === id);
        if (!med) return false;
        med.centralStock += qty;
        await saveToBlob('medicines', medicineStore);
        return true;
    },

    distributeStock: async (medicineId: string, clinicId: string, qty: number): Promise<boolean> => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med || med.centralStock < qty) return false;
        med.centralStock -= qty;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        if (branch) {
            branch.quantity += qty;
        } else {
            med.branchStock.push({ clinicId, quantity: qty });
        }
        await saveToBlob('medicines', medicineStore);
        return true;
    },

    getBranchStock: async (medicineId: string, clinicId: string): Promise<number> => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med) return 0;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        return branch?.quantity || 0;
    },

    getTotalStock: async (medicineId: string): Promise<number> => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med) return 0;
        return med.centralStock + med.branchStock.reduce((sum, b) => sum + b.quantity, 0);
    },

    transferBranchStock: async (medicineId: string, fromClinicId: string, toClinicId: string, qty: number): Promise<boolean> => {
        await ensureMedicinesLoaded();
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
        await saveToBlob('medicines', medicineStore);
        return true;
    }
};

// ── Distribution Records ──────────────────────────────────────
let distributionStore: DistributionRecord[] = [];
let distributionsLoaded = false;

async function ensureDistributionsLoaded() {
    if (!distributionsLoaded) {
        distributionStore = await loadFromBlob<DistributionRecord[]>('distributions', []);
        distributionsLoaded = true;
    }
}

export const DistributionStore = {
    getAll: async (): Promise<DistributionRecord[]> => {
        await ensureDistributionsLoaded();
        return distributionStore;
    },

    getByFilters: async (filters: { medicineId?: string; clinicId?: string }): Promise<DistributionRecord[]> => {
        await ensureDistributionsLoaded();
        return distributionStore.filter(d => {
            if (filters.medicineId && d.medicineId !== filters.medicineId) return false;
            if (filters.clinicId && d.toClinicId !== filters.clinicId && d.fromClinicId !== filters.clinicId) return false;
            return true;
        });
    },

    add: async (record: Omit<DistributionRecord, 'id'>): Promise<DistributionRecord | null> => {
        await ensureDistributionsLoaded();
        let success: boolean;
        if (record.fromClinicId) {
            success = await MedicineStore.transferBranchStock(record.medicineId, record.fromClinicId, record.toClinicId, record.quantity);
        } else {
            success = await MedicineStore.distributeStock(record.medicineId, record.toClinicId, record.quantity);
        }
        if (!success) return null;
        const newRecord: DistributionRecord = { ...record, id: `dist-${Date.now()}` };
        distributionStore.push(newRecord);
        await saveToBlob('distributions', distributionStore);
        return newRecord;
    }
};

// ── Suppliers ─────────────────────────────────────────────────
let supplierStore: Supplier[] = JSON.parse(JSON.stringify(initialSuppliers));
let suppliersLoaded = false;

async function ensureSuppliersLoaded() {
    if (!suppliersLoaded) {
        supplierStore = await loadFromBlob<Supplier[]>('suppliers', supplierStore);
        suppliersLoaded = true;
    }
}

export const SupplierStore = {
    getAll: async (): Promise<Supplier[]> => {
        await ensureSuppliersLoaded();
        return supplierStore;
    },

    getById: async (id: string): Promise<Supplier | undefined> => {
        await ensureSuppliersLoaded();
        return supplierStore.find(s => s.id === id);
    },

    add: async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
        await ensureSuppliersLoaded();
        const newSupplier: Supplier = { ...supplier, id: `sup-${Date.now()}` };
        supplierStore.push(newSupplier);
        await saveToBlob('suppliers', supplierStore);
        return newSupplier;
    },

    update: async (id: string, updates: Partial<Omit<Supplier, 'id'>>): Promise<Supplier | null> => {
        await ensureSuppliersLoaded();
        const index = supplierStore.findIndex(s => s.id === id);
        if (index === -1) return null;
        supplierStore[index] = { ...supplierStore[index], ...updates };
        await saveToBlob('suppliers', supplierStore);
        return supplierStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureSuppliersLoaded();
        const len = supplierStore.length;
        supplierStore = supplierStore.filter(s => s.id !== id);
        if (supplierStore.length < len) {
            await saveToBlob('suppliers', supplierStore);
            return true;
        }
        return false;
    }
};

// ── Purchase Records ──────────────────────────────────────────
let purchaseStore: PurchaseRecord[] = JSON.parse(JSON.stringify(initialPurchases));
let purchasesLoaded = false;

async function ensurePurchasesLoaded() {
    if (!purchasesLoaded) {
        purchaseStore = await loadFromBlob<PurchaseRecord[]>('purchases', purchaseStore);
        purchasesLoaded = true;
    }
}

export const PurchaseStore = {
    getAll: async (): Promise<PurchaseRecord[]> => {
        await ensurePurchasesLoaded();
        return purchaseStore;
    },

    getByFilters: async (filters: { medicineId?: string; supplierId?: string }): Promise<PurchaseRecord[]> => {
        await ensurePurchasesLoaded();
        return purchaseStore.filter(p => {
            if (filters.supplierId && p.supplierId !== filters.supplierId) return false;
            if (filters.medicineId && !p.items.some(item => item.medicineId === filters.medicineId)) return false;
            return true;
        });
    },

    add: async (record: Omit<PurchaseRecord, 'id'>): Promise<PurchaseRecord> => {
        await ensurePurchasesLoaded();
        const newRecord: PurchaseRecord = { ...record, id: `pur-${Date.now()}` };
        purchaseStore.push(newRecord);

        // Auto-create inventory batches and medicine entries for each line item
        for (const item of newRecord.items) {
            const totalQty = item.quantity + (item.focQuantity || 0);
            let targetMedicineId = item.medicineId;

            // If the line links to a registered product, ensure a Medicine entry exists
            if (item.registeredProductId) {
                const product = await RegisteredProductStore.getById(item.registeredProductId);
                let medicine = await MedicineStore.findByProductId(item.registeredProductId);

                if (!medicine && product) {
                    // Auto-create medicine from registered product
                    const consumableUnitPrice = product.consumableItemsInside > 0
                        ? +(product.registeredPrice / product.consumableItemsInside).toFixed(2) : product.registeredPrice;
                    medicine = await MedicineStore.addMedicine({
                        name: product.tradeName,
                        itemCode: product.itemCode,
                        price: consumableUnitPrice,
                        centralStock: 0,
                        branchStock: [],
                        category: product.category,
                        purchaseUnit: product.purchaseUnit,
                        storedType: product.storedType,
                        numberOfStoredType: product.numberOfStoredType,
                        consumableItemsInside: product.consumableItemsInside,
                        consumableUnit: product.consumableUnit,
                        minCentralStock: product.minCentralStock,
                        registeredProductId: product.id,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate,
                    });
                }

                if (medicine) {
                    targetMedicineId = medicine.id;
                }

                // Create InventoryBatch (auto-generate batch number if not provided)
                const batchNum = item.batchNumber || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const batchQty = totalQty * (product?.consumableItemsInside || 1);
                await InventoryBatchStore.add({
                    registeredProductId: item.registeredProductId,
                    medicineId: targetMedicineId,
                    batchNumber: batchNum,
                    quantity: batchQty,
                    initialQuantity: batchQty,
                    expiryDate: item.expiryDate || '',
                    purchaseRecordId: newRecord.id,
                    invoiceNumber: newRecord.billNumber,
                    purchaseDate: newRecord.purchaseDate,
                    centralStock: batchQty,
                    branchStock: [],
                });
            }

            // Always bump central stock on the medicine
            await MedicineStore.addCentralStock(targetMedicineId, totalQty);
        }
        await saveToBlob('purchases', purchaseStore);
        return newRecord;
    },

    remove: async (id: string): Promise<boolean> => {
        await ensurePurchasesLoaded();
        const len = purchaseStore.length;
        purchaseStore = purchaseStore.filter(p => p.id !== id);
        if (purchaseStore.length < len) {
            await saveToBlob('purchases', purchaseStore);
            return true;
        }
        return false;
    }
};

// ── Inventory Batches ─────────────────────────────────────────
let batchStore: InventoryBatch[] = [];
let batchesLoaded = false;

async function ensureBatchesLoaded() {
    if (!batchesLoaded) {
        batchStore = await loadFromBlob<InventoryBatch[]>('inventory-batches', []);
        batchesLoaded = true;
    }
}

export const InventoryBatchStore = {
    getAll: async (): Promise<InventoryBatch[]> => {
        await ensureBatchesLoaded();
        return batchStore;
    },

    getByProduct: async (registeredProductId: string): Promise<InventoryBatch[]> => {
        await ensureBatchesLoaded();
        return batchStore.filter(b => b.registeredProductId === registeredProductId);
    },

    getByMedicine: async (medicineId: string): Promise<InventoryBatch[]> => {
        await ensureBatchesLoaded();
        return batchStore.filter(b => b.medicineId === medicineId);
    },

    getActiveBatches: async (medicineId: string): Promise<InventoryBatch[]> => {
        await ensureBatchesLoaded();
        const today = new Date().toISOString().split('T')[0];
        return batchStore.filter(b => b.medicineId === medicineId && b.quantity > 0 && b.expiryDate >= today);
    },

    add: async (batch: Omit<InventoryBatch, 'id'>): Promise<InventoryBatch> => {
        await ensureBatchesLoaded();
        const newBatch: InventoryBatch = { ...batch, id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
        batchStore.push(newBatch);
        await saveToBlob('inventory-batches', batchStore);
        return newBatch;
    },

    deductFromBatch: async (batchId: string, qty: number, clinicId?: string): Promise<{ success: boolean; message: string }> => {
        await ensureBatchesLoaded();
        const batch = batchStore.find(b => b.id === batchId);
        if (!batch) return { success: false, message: 'Batch not found' };
        // Safety: check expiry
        const today = new Date().toISOString().split('T')[0];
        if (batch.expiryDate && batch.expiryDate < today) return { success: false, message: 'Batch is expired' };
        // Deduct from branch or central
        if (clinicId) {
            const branch = batch.branchStock.find(b => b.clinicId === clinicId);
            if (!branch || branch.quantity < qty) return { success: false, message: 'Insufficient branch stock for this batch' };
            branch.quantity -= qty;
        } else {
            if (batch.centralStock < qty) return { success: false, message: 'Insufficient central stock for this batch' };
            batch.centralStock -= qty;
        }
        batch.quantity -= qty;
        await saveToBlob('inventory-batches', batchStore);
        return { success: true, message: 'Stock deducted' };
    },

    getAlerts: async (): Promise<{ lowStock: InventoryBatch[]; expiringSoon: InventoryBatch[] }> => {
        await ensureBatchesLoaded();
        const today = new Date();
        const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        return {
            lowStock: batchStore.filter(b => b.quantity > 0 && b.quantity <= 5),
            expiringSoon: batchStore.filter(b => b.quantity > 0 && b.expiryDate >= todayStr && b.expiryDate <= sixtyDaysFromNow),
        };
    },
};

// ── Services (uses shared clinic store) ───────────────────────
export const ServicesStore = {
    getClinics: async () => {
        await ensureClinicsLoaded();
        return clinicStore;
    },

    getClinic: async (clinicId: string) => {
        await ensureClinicsLoaded();
        return clinicStore.find(c => c.id === clinicId);
    },

    getServiceById: async (serviceId: string) => {
        await ensureClinicsLoaded();
        for (const clinic of clinicStore) {
            for (const dept of clinic.departments) {
                const service = dept.services.find(s => s.id === serviceId);
                if (service) return service;
            }
        }
        return null;
    },

    addService: async (clinicId: string, departmentId: string, service: Omit<Service, 'id'>) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newService: Service = {
            ...service,
            isTaxable: service.isTaxable || false,
            id: `${departmentId}-svc-${Date.now()}`,
            screeningQuestions: service.screeningQuestions || []
        };

        department.services.push(newService);
        await saveToBlob('clinics', clinicStore);
        return newService;
    },

    removeService: async (clinicId: string, departmentId: string, serviceId: string) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return false;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return false;

        const initialLength = department.services.length;
        department.services = department.services.filter(s => s.id !== serviceId);

        if (department.services.length < initialLength) {
            await saveToBlob('clinics', clinicStore);
            return true;
        }
        return false;
    },

    updateService: async (clinicId: string, departmentId: string, serviceId: string, updates: Partial<Omit<Service, 'id'>>) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const serviceIndex = department.services.findIndex(s => s.id === serviceId);
        if (serviceIndex === -1) return null;

        const updatedService = { ...department.services[serviceIndex], ...updates };
        department.services[serviceIndex] = updatedService;

        await saveToBlob('clinics', clinicStore);
        return updatedService;
    }
};

// ── Category Image Store ──────────────────────────────────────
let categoryImageStore: Record<string, string> = {};
let categoryImagesLoaded = false;

async function ensureCategoryImagesLoaded() {
    if (!categoryImagesLoaded) {
        categoryImageStore = await loadFromBlob<Record<string, string>>('category-images', {});
        categoryImagesLoaded = true;
    }
}

export const CategoryImageStore = {
    getAll: async (): Promise<Record<string, string>> => {
        await ensureCategoryImagesLoaded();
        return { ...categoryImageStore };
    },

    get: async (category: string): Promise<string | undefined> => {
        await ensureCategoryImagesLoaded();
        return categoryImageStore[category];
    },

    set: async (category: string, imageUrl: string): Promise<void> => {
        await ensureCategoryImagesLoaded();
        categoryImageStore[category] = imageUrl;
        await saveToBlob('category-images', categoryImageStore);
    },

    remove: async (category: string): Promise<void> => {
        await ensureCategoryImagesLoaded();
        delete categoryImageStore[category];
        await saveToBlob('category-images', categoryImageStore);
    }
};

// ── Registered Products ───────────────────────────────────────
let registeredProductStore: RegisteredProduct[] = JSON.parse(JSON.stringify(initialRegisteredProducts));
let registeredProductsLoaded = false;

async function ensureRegisteredProductsLoaded() {
    if (!registeredProductsLoaded) {
        registeredProductStore = await loadFromBlob<RegisteredProduct[]>('registered-products', registeredProductStore);
        registeredProductsLoaded = true;
    }
}

export const RegisteredProductStore = {
    getAll: async (): Promise<RegisteredProduct[]> => {
        await ensureRegisteredProductsLoaded();
        return registeredProductStore;
    },

    getById: async (id: string): Promise<RegisteredProduct | undefined> => {
        await ensureRegisteredProductsLoaded();
        return registeredProductStore.find(p => p.id === id);
    },

    add: async (product: Omit<RegisteredProduct, 'id'>): Promise<RegisteredProduct> => {
        await ensureRegisteredProductsLoaded();
        const newProduct: RegisteredProduct = { ...product, id: `rp-${Date.now()}` };
        registeredProductStore.push(newProduct);
        await saveToBlob('registered-products', registeredProductStore);
        return newProduct;
    },

    update: async (id: string, updates: Partial<Omit<RegisteredProduct, 'id'>>): Promise<RegisteredProduct | null> => {
        await ensureRegisteredProductsLoaded();
        const index = registeredProductStore.findIndex(p => p.id === id);
        if (index === -1) return null;
        registeredProductStore[index] = { ...registeredProductStore[index], ...updates };
        await saveToBlob('registered-products', registeredProductStore);
        return registeredProductStore[index];
    },

    remove: async (id: string): Promise<boolean> => {
        await ensureRegisteredProductsLoaded();
        const len = registeredProductStore.length;
        registeredProductStore = registeredProductStore.filter(p => p.id !== id);
        if (registeredProductStore.length < len) {
            await saveToBlob('registered-products', registeredProductStore);
            return true;
        }
        return false;
    }
};
