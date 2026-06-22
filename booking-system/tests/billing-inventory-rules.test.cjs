const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildServiceConsumptions,
    collectInvoiceStockDeductions,
    getBatchAvailableQuantity,
    pickBestBatchForMedicine,
    validateInvoiceStockDeductions,
} = require('../lib/billing-inventory-rules');

const today = new Date('2026-06-21T00:00:00Z');

test('builds service consumptions from linked consumables using FIFO active branch lot', () => {
    const service = {
        consumableIds: ['med-a', 'med-b'],
        consumableQuantities: { 'med-a': 2, 'med-b': 1 },
    };
    const batchesByMedicine = {
        'med-a': [
            { id: 'newer', batchNumber: 'B2', expiryDate: '2027-01-01', quantity: 10, centralStock: 10, branchStock: [{ clinicId: 'clinic-1', quantity: 10 }] },
            { id: 'older', batchNumber: 'B1', expiryDate: '2026-09-01', quantity: 10, centralStock: 10, branchStock: [{ clinicId: 'clinic-1', quantity: 3 }] },
        ],
        'med-b': [
            { id: 'low-branch', batchNumber: 'B3', expiryDate: '2026-08-01', quantity: 10, centralStock: 10, branchStock: [{ clinicId: 'clinic-1', quantity: 0 }] },
        ],
    };

    const consumptions = buildServiceConsumptions(service, batchesByMedicine, 'clinic-1', today);

    assert.deepEqual(consumptions, [
        { medicineId: 'med-a', batchId: 'older', quantity: 2 },
        { medicineId: 'med-b', batchId: undefined, quantity: 1 },
    ]);
});

test('validates missing lots and aggregated required stock before invoice posting', () => {
    const items = [
        { description: 'Service A', quantity: 2, consumptions: [{ medicineId: 'med-a', batchId: 'batch-a', quantity: 2 }] },
        { description: 'Service B', quantity: 1, consumptions: [{ medicineId: 'med-a', batchId: 'batch-a', quantity: 2 }] },
        { description: 'Service C', quantity: 1, consumptions: [{ medicineId: 'med-b', quantity: 1 }] },
    ];
    const batches = [
        { id: 'batch-a', batchNumber: 'LOT-A', expiryDate: '2026-12-31', quantity: 10, centralStock: 10, branchStock: [{ clinicId: 'clinic-1', quantity: 5 }] },
    ];

    const deductions = collectInvoiceStockDeductions(items);
    const errors = validateInvoiceStockDeductions(items, batches, 'clinic-1', today);

    assert.equal(deductions.find(deduction => deduction.batchId === 'batch-a').quantity, 6);
    assert.ok(errors.some(error => error.includes('LOT-A has 5 available; 6 required')));
    assert.ok(errors.some(error => error.includes('physical lot is required')));
});

test('uses branch stock when clinic is provided and central stock otherwise', () => {
    const batch = {
        id: 'batch-a',
        expiryDate: '2027-01-01',
        quantity: 10,
        centralStock: 8,
        branchStock: [{ clinicId: 'clinic-1', quantity: 3 }],
    };

    assert.equal(getBatchAvailableQuantity(batch, 'clinic-1'), 3);
    assert.equal(getBatchAvailableQuantity(batch), 8);
    assert.equal(pickBestBatchForMedicine([batch], 'clinic-1', 4, today), undefined);
    assert.equal(pickBestBatchForMedicine([batch], undefined, 4, today).id, 'batch-a');
});
