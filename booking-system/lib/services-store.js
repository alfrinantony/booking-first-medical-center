"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAdjustmentStore = exports.ExpiredStockStore = exports.StockTransferStore = exports.RegisteredProductStore = exports.CategoryOrderStore = exports.CategoryImageStore = exports.ServicesStore = exports.InventoryBatchStore = exports.PurchaseStore = exports.SupplierStore = exports.DistributionStore = exports.MedicineStore = void 0;
exports.ensureClinicsLoaded = ensureClinicsLoaded;
exports.getClinicStore = getClinicStore;
exports.setClinicStore = setClinicStore;
exports.saveClinicStore = saveClinicStore;
const data_1 = require("./data");
const blob_persistence_1 = require("./blob-persistence");
// ── Clinics (shared backing store for Services + Doctors + Clinics) ─────
let clinicStore = JSON.parse(JSON.stringify(data_1.clinics));
async function ensureClinicsLoaded() {
    clinicStore = await (0, blob_persistence_1.loadFromBlob)('clinics', clinicStore);
}
/** Shared accessor – used by doctors-store & clinics-store to avoid stale caches */
function getClinicStore() { return clinicStore; }
function setClinicStore(stores) { clinicStore = stores; }
async function saveClinicStore() { await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore); }
// ── Medicines ─────────────────────────────────────────────────
let medicineStore = JSON.parse(JSON.stringify(data_1.medicineCatalog));
async function ensureMedicinesLoaded() {
    medicineStore = await (0, blob_persistence_1.loadFromBlob)('medicines', medicineStore);
}
exports.MedicineStore = {
    getMedicines: async () => {
        await ensureMedicinesLoaded();
        return medicineStore;
    },
    getMedicine: async (id) => {
        await ensureMedicinesLoaded();
        return medicineStore.find(m => m.id === id);
    },
    addMedicine: async (medicine) => {
        // NOTE: Manual add is still available internally for purchase-driven creation
        await ensureMedicinesLoaded();
        const newMedicine = { ...medicine, id: `med-${Date.now()}` };
        medicineStore.push(newMedicine);
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return newMedicine;
    },
    // Internal-only: find medicine by registeredProductId
    findByProductId: async (registeredProductId) => {
        await ensureMedicinesLoaded();
        return medicineStore.find(m => m.registeredProductId === registeredProductId);
    },
    updateMedicine: async (id, updates) => {
        await ensureMedicinesLoaded();
        const index = medicineStore.findIndex(m => m.id === id);
        if (index === -1)
            return null;
        medicineStore[index] = { ...medicineStore[index], ...updates };
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return medicineStore[index];
    },
    removeMedicine: async (id) => {
        await ensureMedicinesLoaded();
        const initialLength = medicineStore.length;
        medicineStore = medicineStore.filter(m => m.id !== id);
        if (medicineStore.length < initialLength) {
            await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
            return true;
        }
        return false;
    },
    deductStock: async (id, qty = 1, clinicId) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === id);
        if (!med)
            return false;
        if (clinicId) {
            const branch = med.branchStock.find(b => b.clinicId === clinicId);
            if (!branch || branch.quantity < qty)
                return false;
            branch.quantity -= qty;
        }
        else {
            if (med.centralStock < qty)
                return false;
            med.centralStock -= qty;
        }
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return true;
    },
    addCentralStock: async (id, qty) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === id);
        if (!med)
            return false;
        med.centralStock += qty;
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return true;
    },
    distributeStock: async (medicineId, clinicId, qty) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med || med.centralStock < qty)
            return false;
        med.centralStock -= qty;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        if (branch) {
            branch.quantity += qty;
        }
        else {
            med.branchStock.push({ clinicId, quantity: qty });
        }
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return true;
    },
    getBranchStock: async (medicineId, clinicId) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med)
            return 0;
        const branch = med.branchStock.find(b => b.clinicId === clinicId);
        return branch?.quantity || 0;
    },
    getTotalStock: async (medicineId) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med)
            return 0;
        return med.centralStock + med.branchStock.reduce((sum, b) => sum + b.quantity, 0);
    },
    transferBranchStock: async (medicineId, fromClinicId, toClinicId, qty) => {
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === medicineId);
        if (!med)
            return false;
        const fromBranch = med.branchStock.find(b => b.clinicId === fromClinicId);
        if (!fromBranch || fromBranch.quantity < qty)
            return false;
        fromBranch.quantity -= qty;
        const toBranch = med.branchStock.find(b => b.clinicId === toClinicId);
        if (toBranch) {
            toBranch.quantity += qty;
        }
        else {
            med.branchStock.push({ clinicId: toClinicId, quantity: qty });
        }
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        return true;
    }
};
// ── Distribution Records ──────────────────────────────────────
let distributionStore = [];
async function ensureDistributionsLoaded() {
    distributionStore = await (0, blob_persistence_1.loadFromBlob)('distributions', []);
}
exports.DistributionStore = {
    getAll: async () => {
        await ensureDistributionsLoaded();
        return distributionStore;
    },
    getByFilters: async (filters) => {
        await ensureDistributionsLoaded();
        return distributionStore.filter(d => {
            if (filters.medicineId && d.medicineId !== filters.medicineId)
                return false;
            if (filters.clinicId && d.toClinicId !== filters.clinicId && d.fromClinicId !== filters.clinicId)
                return false;
            return true;
        });
    },
    add: async (record) => {
        await ensureDistributionsLoaded();
        let success;
        if (record.fromClinicId) {
            success = await exports.MedicineStore.transferBranchStock(record.medicineId, record.fromClinicId, record.toClinicId, record.quantity);
        }
        else {
            success = await exports.MedicineStore.distributeStock(record.medicineId, record.toClinicId, record.quantity);
        }
        if (!success)
            return null;
        const newRecord = { ...record, id: `dist-${Date.now()}` };
        distributionStore.push(newRecord);
        await (0, blob_persistence_1.saveToBlob)('distributions', distributionStore);
        return newRecord;
    }
};
// ── Suppliers ─────────────────────────────────────────────────
let supplierStore = JSON.parse(JSON.stringify(data_1.initialSuppliers));
async function ensureSuppliersLoaded() {
    supplierStore = await (0, blob_persistence_1.loadFromBlob)('suppliers', supplierStore);
}
exports.SupplierStore = {
    getAll: async () => {
        await ensureSuppliersLoaded();
        return supplierStore;
    },
    getById: async (id) => {
        await ensureSuppliersLoaded();
        return supplierStore.find(s => s.id === id);
    },
    add: async (supplier) => {
        await ensureSuppliersLoaded();
        const newSupplier = { ...supplier, id: `sup-${Date.now()}` };
        supplierStore.push(newSupplier);
        await (0, blob_persistence_1.saveToBlob)('suppliers', supplierStore);
        return newSupplier;
    },
    update: async (id, updates) => {
        await ensureSuppliersLoaded();
        const index = supplierStore.findIndex(s => s.id === id);
        if (index === -1)
            return null;
        supplierStore[index] = { ...supplierStore[index], ...updates };
        await (0, blob_persistence_1.saveToBlob)('suppliers', supplierStore);
        return supplierStore[index];
    },
    remove: async (id) => {
        await ensureSuppliersLoaded();
        const len = supplierStore.length;
        supplierStore = supplierStore.filter(s => s.id !== id);
        if (supplierStore.length < len) {
            await (0, blob_persistence_1.saveToBlob)('suppliers', supplierStore);
            return true;
        }
        return false;
    }
};
// ── Purchase Records ──────────────────────────────────────────
let purchaseStore = JSON.parse(JSON.stringify(data_1.initialPurchases));
async function ensurePurchasesLoaded() {
    purchaseStore = await (0, blob_persistence_1.loadFromBlob)('purchases', purchaseStore);
}
exports.PurchaseStore = {
    getAll: async () => {
        await ensurePurchasesLoaded();
        return purchaseStore;
    },
    getByFilters: async (filters) => {
        await ensurePurchasesLoaded();
        return purchaseStore.filter(p => {
            if (filters.supplierId && p.supplierId !== filters.supplierId)
                return false;
            if (filters.medicineId && !p.items.some(item => item.medicineId === filters.medicineId))
                return false;
            return true;
        });
    },
    add: async (record) => {
        await ensurePurchasesLoaded();
        const newRecord = { ...record, id: `pur-${Date.now()}` };
        purchaseStore.push(newRecord);
        // Auto-create inventory batches and medicine entries for each line item
        for (const item of newRecord.items) {
            const totalQty = item.quantity + (item.focQuantity || 0);
            let targetMedicineId = item.medicineId;
            // If the line links to a registered product, ensure a Medicine entry exists
            if (item.registeredProductId) {
                const product = await exports.RegisteredProductStore.getById(item.registeredProductId);
                let medicine = await exports.MedicineStore.findByProductId(item.registeredProductId);
                if (!medicine && product) {
                    // Auto-create medicine from registered product
                    const consumableUnitPrice = product.consumableItemsInside > 0
                        ? +(product.registeredPrice / product.consumableItemsInside).toFixed(2) : product.registeredPrice;
                    medicine = await exports.MedicineStore.addMedicine({
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
                await exports.InventoryBatchStore.add({
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
                const prod = await exports.RegisteredProductStore.getById(item.registeredProductId);
                const storedMultiplier = prod?.numberOfStoredType || 1;
                await exports.MedicineStore.addCentralStock(targetMedicineId, totalQty * storedMultiplier);
            }
            else {
                await exports.MedicineStore.addCentralStock(targetMedicineId, totalQty);
            }
        }
        await (0, blob_persistence_1.saveToBlob)('purchases', purchaseStore);
        return newRecord;
    },
    update: async (id, updates) => {
        await ensurePurchasesLoaded();
        const idx = purchaseStore.findIndex(p => p.id === id);
        if (idx === -1)
            return null;
        purchaseStore[idx] = { ...purchaseStore[idx], ...updates };
        await (0, blob_persistence_1.saveToBlob)('purchases', purchaseStore);
        return purchaseStore[idx];
    },
    remove: async (id) => {
        await ensurePurchasesLoaded();
        const len = purchaseStore.length;
        purchaseStore = purchaseStore.filter(p => p.id !== id);
        if (purchaseStore.length < len) {
            await (0, blob_persistence_1.saveToBlob)('purchases', purchaseStore);
            return true;
        }
        return false;
    }
};
// ── Inventory Batches ─────────────────────────────────────────
let batchStore = [];
async function ensureBatchesLoaded() {
    batchStore = await (0, blob_persistence_1.loadFromBlob)('inventory-batches', []);
}
exports.InventoryBatchStore = {
    getAll: async () => {
        await ensureBatchesLoaded();
        return batchStore;
    },
    getByProduct: async (registeredProductId) => {
        await ensureBatchesLoaded();
        return batchStore.filter(b => b.registeredProductId === registeredProductId);
    },
    getByMedicine: async (medicineId) => {
        await ensureBatchesLoaded();
        return batchStore.filter(b => b.medicineId === medicineId);
    },
    getActiveBatches: async (medicineId) => {
        await ensureBatchesLoaded();
        const today = new Date().toISOString().split('T')[0];
        return batchStore.filter(b => b.medicineId === medicineId && b.quantity > 0 && b.expiryDate >= today);
    },
    add: async (batch) => {
        await ensureBatchesLoaded();
        const newBatch = { ...batch, id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
        batchStore.push(newBatch);
        await (0, blob_persistence_1.saveToBlob)('inventory-batches', batchStore);
        return newBatch;
    },
    deductFromBatch: async (batchId, qty, clinicId) => {
        await ensureBatchesLoaded();
        const batch = batchStore.find(b => b.id === batchId);
        if (!batch)
            return { success: false, message: 'Batch not found' };
        // Safety: check expiry
        const today = new Date().toISOString().split('T')[0];
        if (batch.expiryDate && batch.expiryDate < today)
            return { success: false, message: 'Batch is expired' };
        // Deduct from branch or central
        if (clinicId) {
            const branch = batch.branchStock.find(b => b.clinicId === clinicId);
            if (!branch || branch.quantity < qty)
                return { success: false, message: 'Insufficient branch stock for this batch' };
            branch.quantity -= qty;
        }
        else {
            if (batch.centralStock < qty)
                return { success: false, message: 'Insufficient central stock for this batch' };
            batch.centralStock -= qty;
        }
        batch.quantity -= qty;
        await (0, blob_persistence_1.saveToBlob)('inventory-batches', batchStore);
        return { success: true, message: 'Stock deducted' };
    },
    getAlerts: async () => {
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
exports.ServicesStore = {
    getClinics: async () => {
        await ensureClinicsLoaded();
        return clinicStore;
    },
    getClinic: async (clinicId) => {
        await ensureClinicsLoaded();
        return clinicStore.find(c => c.id === clinicId);
    },
    /** Alias used by schedule route */
    getClinicById: async (clinicId) => {
        await ensureClinicsLoaded();
        return clinicStore.find(c => c.id === clinicId);
    },
    getServiceById: async (serviceId) => {
        await ensureClinicsLoaded();
        for (const clinic of clinicStore) {
            for (const dept of clinic.departments) {
                const service = dept.services.find(s => s.id === serviceId);
                if (service)
                    return service;
            }
        }
        return null;
    },
    setGlobalDaysOff: async (doctorId, daysOff) => {
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
            await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore);
        }
        return updated;
    },
    addService: async (clinicId, departmentId, service) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic)
            return null;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return null;
        const newService = {
            ...service,
            isTaxable: service.isTaxable || false,
            id: service.id || `${departmentId}-svc-${Date.now()}`,
            screeningQuestions: service.screeningQuestions || []
        };
        department.services.push(newService);
        await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore);
        return newService;
    },
    removeService: async (clinicId, departmentId, serviceId) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic)
            return false;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return false;
        const initialLength = department.services.length;
        department.services = department.services.filter(s => s.id !== serviceId);
        if (department.services.length < initialLength) {
            await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore);
            return true;
        }
        return false;
    },
    updateService: async (clinicId, departmentId, serviceId, updates) => {
        await ensureClinicsLoaded();
        const clinic = clinicStore.find(c => c.id === clinicId);
        if (!clinic)
            return null;
        const department = clinic.departments.find(d => d.id === departmentId);
        if (!department)
            return null;
        const serviceIndex = department.services.findIndex(s => s.id === serviceId);
        if (serviceIndex === -1)
            return null;
        const updatedService = { ...department.services[serviceIndex], ...updates };
        department.services[serviceIndex] = updatedService;
        await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore);
        return updatedService;
    },
    updateServiceGlobally: async (serviceId, updates) => {
        await ensureClinicsLoaded();
        let updatedAny = false;
        let lastUpdatedService = null;
        // 1. Find the target service name to match across all clinics
        let targetServiceName = null;
        for (const clinic of clinicStore) {
            for (const department of clinic.departments) {
                const svc = department.services.find(s => s.id === serviceId);
                if (svc) {
                    targetServiceName = svc.name;
                    break;
                }
            }
            if (targetServiceName)
                break;
        }
        if (!targetServiceName)
            return null;
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
            await (0, blob_persistence_1.saveToBlob)('clinics', clinicStore);
            return lastUpdatedService;
        }
        return null;
    }
};
// ── Category Image Store ──────────────────────────────────────
let categoryImageStore = {};
async function ensureCategoryImagesLoaded() {
    categoryImageStore = await (0, blob_persistence_1.loadFromBlob)('category-images', {});
}
exports.CategoryImageStore = {
    getAll: async () => {
        await ensureCategoryImagesLoaded();
        return { ...categoryImageStore };
    },
    get: async (category) => {
        await ensureCategoryImagesLoaded();
        return categoryImageStore[category];
    },
    set: async (category, imageUrl) => {
        await ensureCategoryImagesLoaded();
        categoryImageStore[category] = imageUrl;
        await (0, blob_persistence_1.saveToBlob)('category-images', categoryImageStore);
    },
    remove: async (category) => {
        await ensureCategoryImagesLoaded();
        delete categoryImageStore[category];
        await (0, blob_persistence_1.saveToBlob)('category-images', categoryImageStore);
    }
};
// ── Category Order Store ──────────────────────────────────────
let categoryOrderStore = [];
async function ensureCategoryOrderLoaded() {
    categoryOrderStore = await (0, blob_persistence_1.loadFromBlob)('category-order', []);
}
exports.CategoryOrderStore = {
    get: async () => {
        await ensureCategoryOrderLoaded();
        return [...categoryOrderStore];
    },
    set: async (order) => {
        await ensureCategoryOrderLoaded();
        categoryOrderStore = order;
        await (0, blob_persistence_1.saveToBlob)('category-order', categoryOrderStore);
    }
};
// ── Registered Products ───────────────────────────────────────
let registeredProductStore = JSON.parse(JSON.stringify(data_1.initialRegisteredProducts));
async function ensureRegisteredProductsLoaded() {
    registeredProductStore = await (0, blob_persistence_1.loadFromBlob)('registered-products', registeredProductStore);
}
exports.RegisteredProductStore = {
    getAll: async () => {
        await ensureRegisteredProductsLoaded();
        return registeredProductStore;
    },
    getById: async (id) => {
        await ensureRegisteredProductsLoaded();
        return registeredProductStore.find(p => p.id === id);
    },
    add: async (product) => {
        await ensureRegisteredProductsLoaded();
        const newProduct = { ...product, id: `rp-${Date.now()}` };
        registeredProductStore.push(newProduct);
        await (0, blob_persistence_1.saveToBlob)('registered-products', registeredProductStore);
        return newProduct;
    },
    update: async (id, updates) => {
        await ensureRegisteredProductsLoaded();
        const index = registeredProductStore.findIndex(p => p.id === id);
        if (index === -1)
            return null;
        registeredProductStore[index] = { ...registeredProductStore[index], ...updates };
        await (0, blob_persistence_1.saveToBlob)('registered-products', registeredProductStore);
        return registeredProductStore[index];
    },
    remove: async (id) => {
        await ensureRegisteredProductsLoaded();
        const len = registeredProductStore.length;
        registeredProductStore = registeredProductStore.filter(p => p.id !== id);
        if (registeredProductStore.length < len) {
            await (0, blob_persistence_1.saveToBlob)('registered-products', registeredProductStore);
            return true;
        }
        return false;
    }
};
// ── Stock Transfer Requests (4-step workflow) ─────────────────
let transferStore = [];
async function ensureTransfersLoaded() {
    transferStore = await (0, blob_persistence_1.loadFromBlob)('stock-transfers', []);
}
exports.StockTransferStore = {
    getAll: async () => {
        await ensureTransfersLoaded();
        return [...transferStore].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    },
    getByMedicine: async (medicineId) => {
        await ensureTransfersLoaded();
        return transferStore.filter(t => t.medicineId === medicineId);
    },
    getActiveByMedicine: async (medicineId) => {
        await ensureTransfersLoaded();
        return transferStore.filter(t => t.medicineId === medicineId && !['received', 'cancelled'].includes(t.status));
    },
    create: async (data) => {
        await ensureTransfersLoaded();
        const record = {
            ...data,
            id: `tr-${Date.now()}`,
            status: 'requested',
            requestedAt: new Date().toISOString(),
        };
        transferStore.push(record);
        await (0, blob_persistence_1.saveToBlob)('stock-transfers', transferStore);
        return record;
    },
    updateStatus: async (id, newStatus, actorName, extra) => {
        await ensureTransfersLoaded();
        const idx = transferStore.findIndex(t => t.id === id);
        if (idx === -1)
            return { success: false, error: 'Transfer not found' };
        const t = transferStore[idx];
        // Validate transitions
        const valid = {
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
                ? await exports.MedicineStore.deductStock(t.medicineId, t.quantity)
                : await exports.MedicineStore.deductStock(t.medicineId, t.quantity, t.fromLocation);
            if (!ok)
                return { success: false, error: 'Insufficient stock at source location' };
            t.approvedBy = actorName;
            t.approvedAt = new Date().toISOString();
        }
        else if (newStatus === 'in_transit') {
            t.transportedBy = actorName;
            t.dispatchedAt = new Date().toISOString();
        }
        else if (newStatus === 'received') {
            // Credit to destination
            await ensureMedicinesLoaded();
            const med = medicineStore.find(m => m.id === t.medicineId);
            if (!med)
                return { success: false, error: 'Medicine not found' };
            const branch = med.branchStock.find(b => b.clinicId === t.toLocation);
            if (branch) {
                branch.quantity += t.quantity;
            }
            else {
                med.branchStock.push({ clinicId: t.toLocation, quantity: t.quantity });
            }
            await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
            t.receivedBy = actorName;
            t.receivedAt = new Date().toISOString();
        }
        else if (newStatus === 'cancelled') {
            // Refund source if stock was already deducted (approved or in_transit)
            if (['approved', 'in_transit'].includes(t.status)) {
                if (t.fromLocation === 'central') {
                    await exports.MedicineStore.addCentralStock(t.medicineId, t.quantity);
                }
                else {
                    await ensureMedicinesLoaded();
                    const med = medicineStore.find(m => m.id === t.medicineId);
                    if (med) {
                        const branch = med.branchStock.find(b => b.clinicId === t.fromLocation);
                        if (branch) {
                            branch.quantity += t.quantity;
                        }
                        else {
                            med.branchStock.push({ clinicId: t.fromLocation, quantity: t.quantity });
                        }
                        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
                    }
                }
            }
            t.cancelledBy = actorName;
            if (extra?.cancellationReason)
                t.cancellationReason = extra.cancellationReason;
        }
        t.status = newStatus;
        transferStore[idx] = t;
        await (0, blob_persistence_1.saveToBlob)('stock-transfers', transferStore);
        return { success: true, record: t };
    },
};
// ── Expired Stock Quarantine ─────────────────────────────────
let expiredStockStore = [];
async function ensureExpiredStockLoaded() {
    expiredStockStore = await (0, blob_persistence_1.loadFromBlob)('expired-stock', []);
}
exports.ExpiredStockStore = {
    getAll: async () => {
        await ensureExpiredStockLoaded();
        return [...expiredStockStore].sort((a, b) => b.movedAt.localeCompare(a.movedAt));
    },
    getByYear: async (year) => {
        await ensureExpiredStockLoaded();
        return expiredStockStore.filter(r => r.year === year);
    },
    add: async (data) => {
        await ensureExpiredStockLoaded();
        await ensureMedicinesLoaded();
        const med = medicineStore.find(m => m.id === data.medicineId);
        if (!med)
            return { success: false, error: 'Medicine not found' };
        // Deduct from location
        if (data.location === 'central') {
            if (med.centralStock < data.quantity)
                return { success: false, error: 'Insufficient central stock' };
            med.centralStock -= data.quantity;
        }
        else {
            const branch = med.branchStock.find(b => b.clinicId === data.location);
            if (!branch || branch.quantity < data.quantity)
                return { success: false, error: 'Insufficient branch stock' };
            branch.quantity -= data.quantity;
        }
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        const record = {
            id: `exp-${Date.now()}`,
            ...data,
            movedAt: new Date().toISOString(),
            year: new Date().getFullYear(),
        };
        expiredStockStore.push(record);
        await (0, blob_persistence_1.saveToBlob)('expired-stock', expiredStockStore);
        return { success: true, record };
    },
    updateDisposal: async (id, disposalDate, disposalNotes) => {
        await ensureExpiredStockLoaded();
        const idx = expiredStockStore.findIndex(r => r.id === id);
        if (idx === -1)
            return false;
        expiredStockStore[idx].disposalDate = disposalDate;
        expiredStockStore[idx].disposalNotes = disposalNotes;
        await (0, blob_persistence_1.saveToBlob)('expired-stock', expiredStockStore);
        return true;
    },
};
// ── Stock Adjustment Audit ─────────────────────────────────────
let adjustmentStore = [];
async function ensureAdjustmentsLoaded() {
    adjustmentStore = await (0, blob_persistence_1.loadFromBlob)('stock-adjustments', []);
}
exports.StockAdjustmentStore = {
    getAll: async () => {
        await ensureAdjustmentsLoaded();
        return [...adjustmentStore].sort((a, b) => b.adjustedAt.localeCompare(a.adjustedAt));
    },
    add: async (data) => {
        await ensureAdjustmentsLoaded();
        await ensureMedicinesLoaded();
        if (!data.reason?.trim())
            return { success: false, error: 'Reason is required' };
        const med = medicineStore.find(m => m.id === data.medicineId);
        if (!med)
            return { success: false, error: 'Medicine not found' };
        let previousQty;
        if (data.location === 'central') {
            previousQty = med.centralStock;
            med.centralStock = data.newQty;
        }
        else {
            const branch = med.branchStock.find(b => b.clinicId === data.location);
            if (branch) {
                previousQty = branch.quantity;
                branch.quantity = data.newQty;
            }
            else {
                previousQty = 0;
                med.branchStock.push({ clinicId: data.location, quantity: data.newQty });
            }
        }
        await (0, blob_persistence_1.saveToBlob)('medicines', medicineStore);
        const record = {
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
        await (0, blob_persistence_1.saveToBlob)('stock-adjustments', adjustmentStore);
        return { success: true, record };
    },
};
