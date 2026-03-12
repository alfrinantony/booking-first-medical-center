// ─────────────────────────────────────────────────────────────
// Billing Store — Invoice CRUD with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { InventoryBatchStore } from './services-store';

export interface InvoiceLineItem {
    description: string;       // Service name or package name
    quantity: number;
    unitPrice: number;
    total: number;
    // Inventory fields (optional — only for items consumed from inventory)
    medicineId?: string;       // Links to Medicine
    batchId?: string;          // Links to InventoryBatch
    medicineName?: string;     // Display name
}

export interface Invoice {
    id: string;
    invoiceNumber: string;     // Sequential: BFMC-INV-YYYYMMDD-XXXX
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    // Services & Packages
    items: InvoiceLineItem[];
    packageDetails?: string;   // Package name if applicable
    // Amounts
    subtotal: number;          // Before tax
    taxPercentage: number;     // VAT %
    taxAmount: number;         // Calculated tax
    totalAmount: number;       // Including tax
    // Payment
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online';
    paymentConfirmed: boolean;
    // Meta
    clinicId?: string;
    clinicName?: string;
    generatedBy: string;       // Staff name who generated
    date: string;              // ISO date of transaction
    createdAt: string;         // ISO datetime
    notes?: string;
}

// ── In-memory store ──
interface BillingData { invoices: Invoice[]; nextSequence: number; }

let invoices: Invoice[] = [];
let nextSequence = 1;
let billingLoaded = false;

async function ensureBillingLoaded() {
    if (!billingLoaded) {
        const data = await loadFromBlob<BillingData>('billing', { invoices: [], nextSequence: 1 });
        invoices = data.invoices;
        nextSequence = data.nextSequence;
        billingLoaded = true;
    }
}

async function saveBilling() {
    await saveToBlob<BillingData>('billing', { invoices, nextSequence });
}

export const BillingStore = {
    createInvoice: async (data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>): Promise<Invoice> => {
        await ensureBillingLoaded();
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const seqStr = String(nextSequence).padStart(4, '0');
        const invoiceNumber = `BFMC-INV-${today}-${seqStr}`;

        const invoice: Invoice = {
            ...data,
            id: `inv-${Date.now()}`,
            invoiceNumber,
            createdAt: new Date().toISOString(),
        };

        invoices.push(invoice);
        nextSequence++;
        await saveBilling();

        // Auto-deduct inventory batches for items that reference a batchId
        for (const item of invoice.items) {
            if (item.batchId && item.quantity > 0) {
                try {
                    await InventoryBatchStore.deductFromBatch(item.batchId, item.quantity);
                } catch (e) {
                    console.error(`Failed to deduct batch ${item.batchId}:`, e);
                }
            }
        }

        return invoice;
    },

    getInvoices: async (filters?: { clientPhone?: string; clinicId?: string; dateFrom?: string; dateTo?: string }): Promise<Invoice[]> => {
        await ensureBillingLoaded();
        let result = [...invoices];

        if (filters?.clientPhone) {
            result = result.filter(i => i.clientPhone === filters.clientPhone);
        }
        if (filters?.clinicId) {
            result = result.filter(i => i.clinicId === filters.clinicId);
        }
        if (filters?.dateFrom) {
            result = result.filter(i => i.date >= filters.dateFrom!);
        }
        if (filters?.dateTo) {
            result = result.filter(i => i.date <= filters.dateTo!);
        }

        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    getInvoiceById: async (id: string): Promise<Invoice | undefined> => {
        await ensureBillingLoaded();
        return invoices.find(i => i.id === id);
    },
};
