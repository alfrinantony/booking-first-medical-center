function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function isExpiredBatch(batch, today = new Date()) {
    if (!batch || !batch.expiryDate) return false;
    const todayStr = today.toISOString().split('T')[0];
    return String(batch.expiryDate) < todayStr;
}

function getBatchAvailableQuantity(batch, clinicId) {
    if (!batch) return 0;
    if (clinicId) {
        const branch = Array.isArray(batch.branchStock)
            ? batch.branchStock.find(entry => entry.clinicId === clinicId)
            : null;
        return toNumber(branch && branch.quantity, 0);
    }
    return toNumber(batch.centralStock, toNumber(batch.quantity, 0));
}

function sortBatchesByExpiry(a, b) {
    const aExpiry = a && a.expiryDate ? String(a.expiryDate) : '9999-12-31';
    const bExpiry = b && b.expiryDate ? String(b.expiryDate) : '9999-12-31';
    if (aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry);
    return String((a && a.batchNumber) || '').localeCompare(String((b && b.batchNumber) || ''));
}

function pickBestBatchForMedicine(batches, clinicId, requiredQuantity = 1, today = new Date()) {
    return (Array.isArray(batches) ? batches : [])
        .filter(batch =>
            batch &&
            !isExpiredBatch(batch, today) &&
            getBatchAvailableQuantity(batch, clinicId) >= toNumber(requiredQuantity, 1)
        )
        .sort(sortBatchesByExpiry)[0];
}

function buildServiceConsumptions(service, batchesByMedicine, clinicId, today = new Date()) {
    const consumableIds = Array.isArray(service && service.consumableIds) ? service.consumableIds : [];
    const quantities = service && service.consumableQuantities && typeof service.consumableQuantities === 'object'
        ? service.consumableQuantities
        : {};

    return consumableIds
        .filter(Boolean)
        .map(medicineId => {
            const quantity = Math.max(1, toNumber(quantities[medicineId], 1));
            const batch = pickBestBatchForMedicine(
                batchesByMedicine && batchesByMedicine[medicineId],
                clinicId,
                quantity,
                today
            );
            return {
                medicineId,
                batchId: batch && batch.id ? batch.id : undefined,
                quantity,
            };
        });
}

function collectInvoiceStockDeductions(items) {
    const byBatch = new Map();

    for (const item of Array.isArray(items) ? items : []) {
        const itemQuantity = Math.max(1, toNumber(item && item.quantity, 1));
        const consumptions = Array.isArray(item && item.consumptions) ? item.consumptions : [];

        if (consumptions.length > 0) {
            for (const consumption of consumptions) {
                if (!consumption || !consumption.batchId) continue;
                const quantity = Math.max(0, toNumber(consumption.quantity, 0)) * itemQuantity;
                if (quantity <= 0) continue;
                const key = String(consumption.batchId);
                const current = byBatch.get(key) || {
                    batchId: key,
                    medicineId: consumption.medicineId,
                    quantity: 0,
                    descriptions: [],
                };
                current.quantity += quantity;
                if (item.description) current.descriptions.push(item.description);
                byBatch.set(key, current);
            }
        } else if (item && item.batchId) {
            const quantity = itemQuantity;
            const key = String(item.batchId);
            const current = byBatch.get(key) || {
                batchId: key,
                medicineId: item.medicineId,
                quantity: 0,
                descriptions: [],
            };
            current.quantity += quantity;
            if (item.description) current.descriptions.push(item.description);
            byBatch.set(key, current);
        }
    }

    return Array.from(byBatch.values());
}

function validateInvoiceStockDeductions(items, batches, clinicId, today = new Date()) {
    const errors = [];
    const batchMap = new Map((Array.isArray(batches) ? batches : []).map(batch => [String(batch.id), batch]));

    for (let itemIndex = 0; itemIndex < (Array.isArray(items) ? items.length : 0); itemIndex++) {
        const item = items[itemIndex];
        const itemQuantity = Math.max(1, toNumber(item && item.quantity, 1));
        const consumptions = Array.isArray(item && item.consumptions) ? item.consumptions : [];

        for (let consumptionIndex = 0; consumptionIndex < consumptions.length; consumptionIndex++) {
            const consumption = consumptions[consumptionIndex];
            if (!consumption || (!consumption.medicineId && !consumption.batchId)) continue;

            const label = `Item ${itemIndex + 1} resource ${consumptionIndex + 1}`;
            const quantity = Math.max(0, toNumber(consumption.quantity, 0));
            if (!consumption.medicineId) errors.push(`${label}: medicine/consumable is required`);
            if (!consumption.batchId) errors.push(`${label}: physical lot is required`);
            if (quantity <= 0) errors.push(`${label}: quantity must be greater than 0`);

            if (consumption.batchId) {
                const batch = batchMap.get(String(consumption.batchId));
                if (!batch) {
                    errors.push(`${label}: selected physical lot was not found`);
                } else if (isExpiredBatch(batch, today)) {
                    errors.push(`${label}: physical lot ${batch.batchNumber || batch.id} is expired`);
                }
            }
        }
    }

    for (const deduction of collectInvoiceStockDeductions(items)) {
        const batch = batchMap.get(String(deduction.batchId));
        if (!batch) continue;
        const available = getBatchAvailableQuantity(batch, clinicId);
        if (available < deduction.quantity) {
            errors.push(
                `Physical lot ${batch.batchNumber || batch.id} has ${available} available; ${deduction.quantity} required`
            );
        }
    }

    return errors;
}

module.exports = {
    buildServiceConsumptions,
    collectInvoiceStockDeductions,
    getBatchAvailableQuantity,
    isExpiredBatch,
    pickBestBatchForMedicine,
    validateInvoiceStockDeductions,
};
