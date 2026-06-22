import type { InventoryBatch, Service } from './data';
import type { InvoiceLineItem } from './billing-store';

export interface BillingConsumption {
    medicineId: string;
    batchId?: string;
    quantity: number;
}

export interface BillingStockDeduction {
    batchId: string;
    medicineId?: string;
    quantity: number;
    descriptions: string[];
}

export function buildServiceConsumptions(
    service: Partial<Service> | null | undefined,
    batchesByMedicine: Record<string, InventoryBatch[]>,
    clinicId?: string,
    today?: Date
): BillingConsumption[];

export function collectInvoiceStockDeductions(items: Array<Partial<InvoiceLineItem>>): BillingStockDeduction[];
export function getBatchAvailableQuantity(batch: Partial<InventoryBatch> | null | undefined, clinicId?: string): number;
export function isExpiredBatch(batch: Partial<InventoryBatch> | null | undefined, today?: Date): boolean;
export function pickBestBatchForMedicine(
    batches: Array<Partial<InventoryBatch>>,
    clinicId?: string,
    requiredQuantity?: number,
    today?: Date
): InventoryBatch | undefined;
export function validateInvoiceStockDeductions(
    items: Array<Partial<InvoiceLineItem>>,
    batches: Array<Partial<InventoryBatch>>,
    clinicId?: string,
    today?: Date
): string[];
