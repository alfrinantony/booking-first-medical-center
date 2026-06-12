import { clinics as initialClinics, Clinic, Service, Medicine, medicineCatalog as initialMedicines, Supplier, initialSuppliers, PurchaseRecord, initialPurchases, DistributionRecord, RegisteredProduct, initialRegisteredProducts, InventoryBatch, BranchStockEntry, StockTransferRequest, TransferStatus, ExpiredStockRecord, StockAdjustmentRecord } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

// ── Clinics (shared backing store for Services + Doctors + Clinics) ─────
let clinicStore: Clinic[] = JSON.parse(JSON.stringify(initialClinics));
export async function ensureClinicsLoaded() {
    clinicStore = await loadFromBlob<Clinic[]>('clinics', clinicStore);
}

/** Shared accessor – used by doctors-store & clinics-store to avoid stale caches */
export function getClinicStore(): Clinic[] { return clinicStore; }
export function setClinicStore(stores: Clinic[]) { clinicStore = stores; }
export async function saveClinicStore() { await saveToBlob('clinics', clinicStore); }

// ── Medicines ─────────────────────────────────────────────────
let medicineStore: Medicine[] = JSON.parse(JSON.stringify(initialMedicines));
async function ensureMedicinesLoaded() {
    medicineStore = await loadFromBlob<Medicine[]>('medicines', medicineStore);
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
async function ensureDistributionsLoaded() {
    
        distributionStore = await loadFromBlob<DistributionRecord[]>('distributions', []);
        
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
async function ensureSuppliersLoaded() {
    supplierStore = await loadFromBlob<Supplier[]>('suppliers', supplierStore);
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
async function ensurePurchasesLoaded() {
    purchaseStore = await loadFromBlob<PurchaseRecord[]>('purchases', purchaseStore);
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

            // Always bump central stock on the medicine (multiply by numberOfStoredType)
            if (item.registeredProductId) {
                const prod = await RegisteredProductStore.getById(item.registeredProductId);
                const storedMultiplier = prod?.numberOfStoredType || 1;
                await MedicineStore.addCentralStock(targetMedicineId, totalQty * storedMultiplier);
            } else {
                await MedicineStore.addCentralStock(targetMedicineId, totalQty);
            }
        }
        await saveToBlob('purchases', purchaseStore);
        return newRecord;
    },

    update: async (id: string, updates: Partial<Omit<PurchaseRecord, 'id'>>): Promise<PurchaseRecord | null> => {
        await ensurePurchasesLoaded();
        const idx = purchaseStore.findIndex(p => p.id === id);
        if (idx === -1) return null;
        purchaseStore[idx] = { ...purchaseStore[idx], ...updates };
        await saveToBlob('purchases', purchaseStore);
        return purchaseStore[idx];
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
async function ensureBatchesLoaded() {
    
        batchStore = await loadFromBlob<InventoryBatch[]>('inventory-batches', []);
        
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

    /** Alias used by schedule route */
    getClinicById: async (clinicId: string) => {
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

    setGlobalDaysOff: async (doctorId: string, daysOff: number[]) => {
        await ensureClinicsLoaded();
        let updated = false;
        for (const clinic of clinicStore) {
            for (const dept of clinic.departments) {
                const doc = dept.doctors.find(d => d.id === doctorId);
                if (doc) {
                    doc.daysOff = daysOff;
                    updated = true;
                }
            }
        }
        if (updated) {
            await saveToBlob('clinics', clinicStore);
        }
        return updated;
    },

    addService: async (clinicId: string, departmentId: string, service: Partial<Service> & { name: string, price: number, duration: number }) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic) return null;

        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department) return null;

        const newService: Service = {
            ...service,
            isTaxable: service.isTaxable || false,
            id: service.id || `${departmentId}-svc-${Date.now()}`,
            screeningQuestions: service.screeningQuestions || []
        } as Service;

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
    },

    updateServiceGlobally: async (serviceId: string, updates: Partial<Service>) => {
        await ensureClinicsLoaded();
        let updatedAny = false;
        let lastUpdatedService = null;

        // 1. Find the target service name to match across all clinics
        let targetServiceName: string | null = null;
        for (const clinic of clinicStore) {
            for (const department of clinic.departments) {
                const svc = department.services.find(s => s.id === serviceId);
                if (svc) {
                    targetServiceName = svc.name;
                    break;
                }
            }
            if (targetServiceName) break;
        }

        if (!targetServiceName) return null;

        // 2. Update all services with that name across all clinics
        for (const clinic of clinicStore) {
            for (const department of clinic.departments) {
                department.services.forEach((s, index) => {
                    if (s.name === targetServiceName) {
                        const updatedService = { ...s, ...updates };
                        department.services[index] = updatedService;
                        lastUpdatedService = updatedService;
                        updatedAny = true;
                    }
                });
            }
        }

        if (updatedAny) {
            await saveToBlob('clinics', clinicStore);
            return lastUpdatedService;
        }
        return null;
    }
};

// ── Category Image Store ──────────────────────────────────────
let categoryImageStore: Record<string, string> = {};
async function ensureCategoryImagesLoaded() {
    
        categoryImageStore = await loadFromBlob<Record<string, string>>('category-images', {});
        
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

// ── Category Order Store ──────────────────────────────────────
let categoryOrderStore: string[] = [];
async function ensureCategoryOrderLoaded() {
    categoryOrderStore = await loadFromBlob<string[]>('category-order', []);
}

export const CategoryOrderStore = {
    get: async (): Promise<string[]> => {
        await ensureCategoryOrderLoaded();
        return [...categoryOrderStore];
    },

    set: async (order: string[]): Promise<void> => {
        await ensureCategoryOrderLoaded();
        categoryOrderStore = order;
        await saveToBlob('category-order', categoryOrderStore);
    }
};

// ── Registered Products ───────────────────────────────────────
let registeredProductStore: RegisteredProduct[] = JSON.parse(JSON.stringify(initialRegisteredProducts));
async function ensureRegisteredProductsLoaded() {
    
        registeredProductStore = await loadFromBlob<RegisteredProduct[]>('registered-products', registeredProductStore);
        
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

// ── Stock Transfer Requests (4-step workflow) ─────────────────
let transferStore: StockTransferRequest[] = [];
async function ensureTransfersLoaded() {
    transferStore = await loadFromBlob<StockTransferRequest[]>('stock-transfers', []);
}

export const StockTransferStore = {
    getAll: async (): Promise<StockTransferRequest[]> => {
        await ensureTransfersLoaded();
        return [...transferStore].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    },

    getByMedicine: async (medicineId: string): Promise<StockTransferRequest[]> => {
        await ensureTransfersLoaded();
        return transferStore.filter(t => t.medicineId === medicineId);
    },

    getActiveByMedicine: async (medicineId: string): Promise<StockTransferRequest[]> => {
        await ensureTransfersLoaded();
        return transferStore.filter(t => t.medicineId === medicineId && !['received', 'cancelled'].includes(t.status));
    },

    create: async (data: Omit<StockTransferRequest, 'id' | 'requestedAt' | 'status'>): Promise<StockTransferRequest> => {
        await ensureTransfersLoaded();
        const record: StockTransferRequest = {
            ...data,
            id: `tr-${Date.now()}`,
            status: 'requested',
            requestedAt: new Date().toISOString(),
        };
        transferStore.push(record);
        await saveToBlob('stock-transfers', transferStore);
        return record;
    },

    updateStatus: async (
        id: string,
        newStatus: TransferStatus,
        actorName: string,
        extra?: { cancellationReason?: string }
    ): Promise<{ success: boolean; error?: string; record?: StockTransferRequest }> => {
        await ensureTransfersLoaded();
        const idx = transferStore.findIndex(t => t.id === id);
        if (idx === -1) return { success: false, error: 'Transfer not found' };
        const t = transferStore[idx];

        // Validate transitions
        const valid: Record<TransferStatus, TransferStatus[]> = {
            requested: ['approved', 'cancelled'],
            approved: ['in_transit', 'cancelled'],
            in_transit: ['received', 'cancelled'],
            received: [],
            cancelled: [],
        };
        if (!valid[t.status].includes(newStatus)) {
            return { success: false, error: `Cannot move from ${t.status} to ${newStatus}` };
        }

        // ── Stock mutations ──
        if (newStatus === 'approved') {
            // Deduct from source at approval
            const ok = t.fromLocation === 'central'
                ? await MedicineStore.deductStock(t.medicineId, t.quantity)
                : await MedicineStore.deductStock(t.medicineId, t.quantity, t.fromLocation);
            if (!ok) return { success: false, error: 'Insufficient stock at source location' };
            t.approvedBy = actorName;
            t.approvedAt = new Date().toISOString();
        } else if (newStatus === 'in_transit') {
            t.transportedBy = actorName;
            t.dispatchedAt = new Date().toISOString();
        } else if (newStatus === 'received') {
            // Credit to destination
            await ensureMedicinesLoaded();
            const med = medicineStore.find(m => m.id === t.medicineId);
            if (!med) return { success: false, error: 'Medicine not found' };
            const branch = med.branchStock.find(b => b.clinicId === t.toLocation);
            if (branch) { branch.quantity += t.quantity; } else { med.branchStock.push({ clinicId: t.toLocation, quantity: t.quantity }); }
            await saveToBlob('medicines', medicineStore);
            t.receivedBy = actorName;
            t.receivedAt = new Date().toISOString();
        } else if (newStatus === 'cancelled') {
            // Refund source if stock was already deducted (approved or in_transit)
            if (['approved', 'in_transit'].includes(t.status)) {
                if (t.fromLocation === 'central') {
                    await MedicineStore.addCentralStock(t.medicineId, t.quantity);
                } else {
                    await ensureMedicinesLoaded();
                    const med = medicineStore.find(m => m.id === t.medicineId);
                    if (med) {
                        const branch = med.branchStock.find(b => b.clinicId === t.fromLocation);
                        if (branch) { branch.quantity += t.quantity; } else { med.branchStock.push({ clinicId: t.fromLocation, quantity: t.quantity }); }
                        await saveToBlob('medicines', medicineStore);
                    }
                }
            }
            t.cancelledBy = actorName;
            if (extra?.cancellationReason) t.cancellationReason = extra.cancellationReason;
        }

        t.status = newStatus;
        transferStore[idx] = t;
        await saveToBlob('stock-transfers', transferStore);
        return { success: true, record: t };
    },
};

// ── Expired Stock Quarantine ─────────────────────────────────
let expiredStockStore: ExpiredStockRecord[] = [];
async function ensureExpiredStockLoaded() {
    expiredStockStore = await loadFromBlob<ExpiredStockRecord[]>('expired-stock', []);
}

export const ExpiredStockStore = {
    getAll: async (): Promise<ExpiredStockRecord[]> => {
        await ensureExpiredStockLoaded();
        return [...expiredStockStore].sort((a, b) => b.movedAt.localeCompare(a.movedAt));
    },

    getByYear: async (year: number): Promise<ExpiredStockRecord[]> => {
        await ensureExpiredStockLoaded();
        return expiredStockStore.filter(r => r.year === year);
    },

    add: async (data: {
        medicineId: string;
        medicineName: string;
        quantity: number;
        expiryDate: string;
        location: string;
        movedBy: string;
        batchNumber?: string;
    }): Promise<{ success: boolean; error?: string; record?: ExpiredStockRecord }> => {
        await ensureExpiredStockLoaded();
        await ensureMedicinesLoaded();

        const med = medicineStore.find(m => m.id === data.medicineId);
        if (!med) return { success: false, error: 'Medicine not found' };

        // Deduct from location
        if (data.location === 'central') {
            if (med.centralStock < data.quantity) return { success: false, error: 'Insufficient central stock' };
            med.centralStock -= data.quantity;
        } else {
            const branch = med.branchStock.find(b => b.clinicId === data.location);
            if (!branch || branch.quantity < data.quantity) return { success: false, error: 'Insufficient branch stock' };
            branch.quantity -= data.quantity;
        }
        await saveToBlob('medicines', medicineStore);

        const record: ExpiredStockRecord = {
            id: `exp-${Date.now()}`,
            ...data,
            movedAt: new Date().toISOString(),
            year: new Date().getFullYear(),
        };
        expiredStockStore.push(record);
        await saveToBlob('expired-stock', expiredStockStore);
        return { success: true, record };
    },

    updateDisposal: async (id: string, disposalDate: string, disposalNotes: string): Promise<boolean> => {
        await ensureExpiredStockLoaded();
        const idx = expiredStockStore.findIndex(r => r.id === id);
        if (idx === -1) return false;
        expiredStockStore[idx].disposalDate = disposalDate;
        expiredStockStore[idx].disposalNotes = disposalNotes;
        await saveToBlob('expired-stock', expiredStockStore);
        return true;
    },
};

// ── Stock Adjustment Audit ─────────────────────────────────────
let adjustmentStore: StockAdjustmentRecord[] = [];
async function ensureAdjustmentsLoaded() {
    adjustmentStore = await loadFromBlob<StockAdjustmentRecord[]>('stock-adjustments', []);
}

export const StockAdjustmentStore = {
    getAll: async (): Promise<StockAdjustmentRecord[]> => {
        await ensureAdjustmentsLoaded();
        return [...adjustmentStore].sort((a, b) => b.adjustedAt.localeCompare(a.adjustedAt));
    },

    add: async (data: {
        medicineId: string;
        medicineName: string;
        location: string;
        newQty: number;
        adjustedBy: string;
        reason: string;
    }): Promise<{ success: boolean; error?: string; record?: StockAdjustmentRecord }> => {
        await ensureAdjustmentsLoaded();
        await ensureMedicinesLoaded();

        if (!data.reason?.trim()) return { success: false, error: 'Reason is required' };

        const med = medicineStore.find(m => m.id === data.medicineId);
        if (!med) return { success: false, error: 'Medicine not found' };

        let previousQty: number;
        if (data.location === 'central') {
            previousQty = med.centralStock;
            med.centralStock = data.newQty;
        } else {
            const branch = med.branchStock.find(b => b.clinicId === data.location);
            if (branch) {
                previousQty = branch.quantity;
                branch.quantity = data.newQty;
            } else {
                previousQty = 0;
                med.branchStock.push({ clinicId: data.location, quantity: data.newQty });
            }
        }
        await saveToBlob('medicines', medicineStore);

        const record: StockAdjustmentRecord = {
            id: `adj-${Date.now()}`,
            medicineId: data.medicineId,
            medicineName: data.medicineName,
            location: data.location,
            previousQty,
            newQty: data.newQty,
            adjustedBy: data.adjustedBy,
            adjustedAt: new Date().toISOString(),
            reason: data.reason.trim(),
        };
        adjustmentStore.push(record);
        await saveToBlob('stock-adjustments', adjustmentStore);
        return { success: true, record };
    },
};
