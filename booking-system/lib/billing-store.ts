// ─────────────────────────────────────────────────────────────
// Billing Store — Invoice CRUD + Refund with Azure Blob persistence
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
    isVoid?: boolean;          // Marked void after refund
}

export type InvoiceCategory = 'online_single' | 'online_package' | 'clinic_single' | 'clinic_package' | 'package_session';

export interface Invoice {
    id: string;
    invoiceNumber: string;     // Sequential: BFMC-INV-YYYYMMDD-XXXX
    invoiceCategory?: InvoiceCategory;
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
    paymentReceivedBy?: string;       // Who received the payment
    paymentReceptionStatus?: 'received' | 'pending' | 'partial';
    // Refund fields
    refundStatus: 'none' | 'refunded';
    refundedAt?: string;              // ISO datetime
    refundedBy?: string;              // Staff name who processed
    refundAmount?: number;
    refundReason?: string;
    refundIban?: string;              // Required for cash/clinic refunds
    refundBankName?: string;          // Required for cash/clinic refunds
    isVoid?: boolean;                 // Entire invoice voided after refund
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
async function ensureBillingLoaded() {
    
        const data = await loadFromBlob<BillingData>('billing', { invoices: [], nextSequence: 1 });
        invoices = data.invoices;
        nextSequence = data.nextSequence;
        
}

async function saveBilling() {
    await saveToBlob<BillingData>('billing', { invoices, nextSequence });
}

export const BillingStore = {
    createInvoice: async (data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'refundStatus'>): Promise<Invoice> => {
        await ensureBillingLoaded();
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const seqStr = String(nextSequence).padStart(4, '0');
        
        let prefix = 'BFMC-INV-';
        if (data.invoiceCategory === 'online_single') prefix = 'O-SS-INV-';
        else if (data.invoiceCategory === 'online_package') prefix = 'O-PKG-INV-';
        else if (data.invoiceCategory === 'clinic_single') prefix = 'C-SS-INV-';
        else if (data.invoiceCategory === 'clinic_package') prefix = 'C-PKG-INV-';
        else if (data.invoiceCategory === 'package_session') prefix = 'PKG-SES-INV-';
        
        const invoiceNumber = `${prefix}${today}-${seqStr}`;

        const invoice: Invoice = {
            ...data,
            id: `inv-${Date.now()}`,
            invoiceNumber,
            createdAt: new Date().toISOString(),
            refundStatus: 'none',
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

    getInvoices: async (filters?: {
        clientPhone?: string;
        clientEmail?: string;
        clinicId?: string;
        dateFrom?: string;
        dateTo?: string;
        invoiceNumber?: string;
        paymentMethod?: string;
        search?: string;
        refundStatus?: string;
    }): Promise<Invoice[]> => {
        await ensureBillingLoaded();
        let result = [...invoices];

        if (filters?.clientPhone) {
            result = result.filter(i => i.clientPhone.includes(filters.clientPhone!));
        }
        if (filters?.clientEmail) {
            result = result.filter(i => i.clientEmail?.toLowerCase().includes(filters.clientEmail!.toLowerCase()));
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
        if (filters?.invoiceNumber) {
            result = result.filter(i => i.invoiceNumber.toLowerCase().includes(filters.invoiceNumber!.toLowerCase()));
        }
        if (filters?.paymentMethod) {
            result = result.filter(i => i.paymentMethod === filters.paymentMethod);
        }
        if (filters?.refundStatus) {
            result = result.filter(i => (i.refundStatus || 'none') === filters.refundStatus);
        }
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(i =>
                i.clientName.toLowerCase().includes(q) ||
                i.clientPhone.includes(q) ||
                (i.clientEmail || '').toLowerCase().includes(q) ||
                i.invoiceNumber.toLowerCase().includes(q)
            );
        }

        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    getInvoiceById: async (id: string): Promise<Invoice | undefined> => {
        await ensureBillingLoaded();
        return invoices.find(i => i.id === id);
    },

    refundInvoice: async (
        invoiceId: string,
        refundData: {
            refundedBy: string;
            refundAmount: number;
            refundReason: string;
            refundIban?: string;
            refundBankName?: string;
        }
    ): Promise<{ success: boolean; message: string; invoice?: Invoice }> => {
        await ensureBillingLoaded();
        const idx = invoices.findIndex(i => i.id === invoiceId);
        if (idx === -1) return { success: false, message: 'Invoice not found' };

        const inv = invoices[idx];
        if (inv.refundStatus === 'refunded') return { success: false, message: 'Invoice has already been refunded' };

        // For cash/clinic payments, IBAN and bank name are required
        if ((inv.paymentMethod === 'cash' || inv.paymentMethod === 'bank_transfer') && (!refundData.refundIban || !refundData.refundBankName)) {
            return { success: false, message: 'IBAN and bank name are required for cash/bank transfer refunds' };
        }

        // Mark all items as void
        const voidedItems = inv.items.map(item => ({ ...item, isVoid: true }));

        invoices[idx] = {
            ...inv,
            items: voidedItems,
            refundStatus: 'refunded',
            refundedAt: new Date().toISOString(),
            refundedBy: refundData.refundedBy,
            refundAmount: refundData.refundAmount,
            refundReason: refundData.refundReason,
            refundIban: refundData.refundIban,
            refundBankName: refundData.refundBankName,
            isVoid: true,
        };

        await saveBilling();
        return { success: true, message: 'Refund processed successfully', invoice: invoices[idx] };
    },
};
