// ─────────────────────────────────────────────────────────────
// Billing Store — Invoice CRUD + Refund with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { InventoryBatchStore } from './services-store';
import { PackagesStore } from './packages-store';
import { LogsStore } from './logs-store';
import {
    collectInvoiceStockDeductions,
    validateInvoiceStockDeductions
} from './billing-inventory-rules';

export class DuplicateInvoiceError extends Error {
    invoice: Invoice;

    constructor(invoice: Invoice) {
        super(`Invoice already exists for this booking: ${invoice.invoiceNumber}`);
        this.name = 'DuplicateInvoiceError';
        this.invoice = invoice;
    }
}

export interface InvoiceLineItemConsumption {
    medicineId: string;
    batchId?: string;
    quantity: number;
}

export interface InvoiceLineItem {
    description: string;       // Service name or package name
    quantity: number;
    unitPrice: number;         // Final price after discount
    regularPrice?: number;     // Original price before discount
    total: number;
    // Inventory fields (legacy single-item deduction)
    medicineId?: string;       // Links to Medicine
    batchId?: string;          // Links to InventoryBatch
    medicineName?: string;     // Display name
    // Modern multi-item deduction array
    discountAmount?: number;   // Discount applied (AED)
    consumptions?: InvoiceLineItemConsumption[];
    isVoid?: boolean;          // Marked void after refund
}

export type InvoiceCategory = 'online_single' | 'online_package' | 'clinic_single' | 'clinic_package' | 'package_session';

export interface PaymentRecord {
    id: string;                 // e.g. pay-timestamp
    amount: number;
    mode: 'cash' | 'card' | 'bank_transfer' | 'online';
    referenceNumber: string;    // e.g. FMC-CSH-0001
    date: string;               // ISO datetime
}

export interface Invoice {
    id: string;
    invoiceNumber: string;     // Legacy: BFMC-INV-..., New: FMC-[PKG|SIV|PIV|RFD|CN]-XXXX
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
    // Payment Legacy & New
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online';
    paymentConfirmed: boolean;
    paymentReceivedBy?: string;       // Who received the payment
    paymentReceptionStatus?: 'received' | 'pending' | 'partial';
    payments?: PaymentRecord[];       // Support for splitted or multiple payments
    // Refund fields
    refundStatus: 'none' | 'refunded';
    refundedAt?: string;              // ISO datetime
    refundedBy?: string;              // Staff name who processed
    refundAmount?: number;
    refundReason?: string;
    refundAccountName?: string;       // Required for cash/clinic refunds
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
    // Booking linkage
    bookingId?: string;        // Links to BookingsStore booking ID
    sbId?: string;             // Links to SimplyBook booking ID (for SB-sourced bookings)
    // Online payment traceability
    onlineReference?: string;  // SB invoice number, Stripe charge ID, or other online ref
}

// ── In-memory store ──
interface BillingCounters {
    package: number;
    single: number;
    pSession: number;
    refund: number;
    creditNote: number;
    cash: number;
    card: number;
    bank: number;
    online: number;
    legacySequence: number; // to not break any existing tests or code
}

interface BillingData { invoices: Invoice[]; counters: BillingCounters; nextSequence?: number; }

let invoices: Invoice[] = [];
let counters: BillingCounters = {
    package: 1, single: 1, pSession: 1, refund: 1, creditNote: 1,
    cash: 1, card: 1, bank: 1, online: 1, legacySequence: 1
};
async function ensureBillingLoaded() {
        const defaultCounters: BillingCounters = {
            package: 1, single: 1, pSession: 1, refund: 1, creditNote: 1,
            cash: 1, card: 1, bank: 1, online: 1, legacySequence: 1
        };
        const data = await loadFromBlob<any>('billing', { invoices: [], counters: defaultCounters });
        if (Array.isArray(data)) {
            invoices = data;
            counters = defaultCounters;
        } else {
            invoices = data.invoices || [];
            // Migration mapping for legacy nextSequence
            if (data.nextSequence !== undefined && (!data.counters || data.counters.legacySequence === 1)) {
                counters = { ...defaultCounters, legacySequence: data.nextSequence };
            } else {
                counters = { ...defaultCounters, ...(data.counters || {}) };
            }
        }
}

async function saveBilling() {
    await saveToBlob<BillingData>('billing', { invoices, counters });
}

// Formatters
function generateDocumentNumber(type: 'PKG' | 'SIV' | 'PIV' | 'RFD' | 'CN'): string {
    let key: keyof BillingCounters;
    if (type === 'PKG') key = 'package';
    else if (type === 'SIV') key = 'single';
    else if (type === 'PIV') key = 'pSession';
    else if (type === 'RFD') key = 'refund';
    else key = 'creditNote';

    const num = counters[key];
    counters[key]++;
    return `FMC-${type}-${String(num).padStart(4, '0')}`;
}

function generatePaymentRef(mode: 'cash' | 'card' | 'bank_transfer' | 'online'): string {
    let key: keyof BillingCounters;
    let typeStr = '';
    if (mode === 'cash') { key = 'cash'; typeStr = 'CSH'; }
    else if (mode === 'card') { key = 'card'; typeStr = 'CRD'; }
    else if (mode === 'bank_transfer') { key = 'bank'; typeStr = 'BNK'; }
    else { key = 'online'; typeStr = 'ONL'; }

    const num = counters[key];
    counters[key]++;
    return `FMC-${typeStr}-${String(num).padStart(4, '0')}`;
}

export const BillingStore = {
    createInvoice: async (data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'refundStatus' | 'payments'>): Promise<Invoice> => {
        await ensureBillingLoaded();
        const allowDuplicate = (data as any).allowDuplicate === true;
        if (!allowDuplicate) {
            const duplicate = invoices.find(inv =>
                !inv.isVoid &&
                inv.refundStatus !== 'refunded' &&
                (
                    (!!data.bookingId && inv.bookingId === data.bookingId) ||
                    (!!data.sbId && inv.sbId === data.sbId) ||
                    (!!data.onlineReference && inv.onlineReference === data.onlineReference)
                )
            );
            if (duplicate) {
                throw new DuplicateInvoiceError(duplicate);
            }
        }
        
        let docType: 'PKG' | 'SIV' | 'PIV' = 'SIV';
        if (data.invoiceCategory === 'online_package' || data.invoiceCategory === 'clinic_package') docType = 'PKG';
        else if (data.invoiceCategory === 'package_session') docType = 'PIV';
        else docType = 'SIV'; // online_single, clinic_single
        
        const invoiceNumber = generateDocumentNumber(docType);

        const payments: PaymentRecord[] = [];
        // Support generating the payment reference if an initial payment is successfully received checkout, especially online or card
        if (data.paymentConfirmed || data.totalAmount > 0) {
            // we create a payment record specifically if it expects one immediately
            // but wait, if it's cash pending in clinic, we might not generate it until clinic receives it.
            // Let's generate it always for simplicity if paymentMethod is present and it is a paid invoice
            // Except for 'package_session' where totalAmount is 0 and requires no payment
            if (docType !== 'PIV' || (docType === 'PIV' && data.totalAmount > 0)) {
                payments.push({
                    id: `pay-${Date.now()}`,
                    amount: data.totalAmount,
                    mode: data.paymentMethod,
                    referenceNumber: generatePaymentRef(data.paymentMethod),
                    date: new Date().toISOString()
                });
            }
        }

        const invoice: Invoice = {
            ...data,
            id: `inv-${Date.now()}`,
            invoiceNumber,
            payments,
            createdAt: new Date().toISOString(),
            refundStatus: 'none',
        };

        const hasStockLinks = invoice.items.some(item =>
            item.batchId ||
            (Array.isArray(item.consumptions) && item.consumptions.some(consumption =>
                consumption && (consumption.medicineId || consumption.batchId)
            ))
        );
        const stockDeductions = collectInvoiceStockDeductions(invoice.items);
        if (hasStockLinks) {
            const batches = await InventoryBatchStore.getAll();
            const stockErrors = validateInvoiceStockDeductions(invoice.items, batches, invoice.clinicId);
            if (stockErrors.length > 0) {
                throw new Error(`Stock deduction blocked:\n${stockErrors.join('\n')}`);
            }

            for (const deduction of stockDeductions) {
                const result = await InventoryBatchStore.deductFromBatch(
                    deduction.batchId,
                    deduction.quantity,
                    invoice.clinicId
                );
                if (!result.success) {
                    throw new Error(`Stock deduction failed for batch ${deduction.batchId}: ${result.message}`);
                }
            }
        }

        invoices.push(invoice);
        await saveBilling();
        await LogsStore.add({
            userId: 'system',
            userName: invoice.generatedBy || 'Billing',
            action: 'INVOICE_GENERATED',
            details: `Generated invoice ${invoice.invoiceNumber} for ${invoice.clientName}${invoice.bookingId ? ` (booking ${invoice.bookingId})` : ''}`,
            entityId: invoice.id,
            entityType: 'Invoice'
        });

        // Auto-deduct inventory batches for items that reference a batchId
        for (const item of invoice.items) {
            // New Dashboard Package injection from Clinic Billing interface
            if ((item as any).packagePayload) {
                const p = (item as any).packagePayload;
                try {
                    const pkgName = `${p.serviceName} - ${p.sessionCount} Sessions`;
                    const pkg = await PackagesStore.createPackage({
                        name: pkgName,
                        description: `${p.sessionCount}-session package for ${p.serviceName}. Valid for ${p.validity} days.`,
                        price: Number(p.price),
                        validityInDays: Number(p.validity),
                        items: [{ serviceId: p.serviceId, serviceName: p.serviceName, count: Number(p.sessionCount) }],
                        active: true,
                        source: 'admin',
                    });

                    // Assign to the customer (Clinic sales are immediately treated as paid if generating a tax invoice)
                    const method = data.paymentMethod === 'card' || data.paymentMethod === 'online' ? 'credit_card' : 'pay_at_clinic';
                    const cPkg = await PackagesStore.purchasePackage(pkg.id, invoice.clientName, invoice.clientPhone, method);

                    if (cPkg && (payments.length > 0 || data.totalAmount === 0)) {
                        await PackagesStore.confirmPayment(cPkg.id);
                    }
                } catch (e) {
                    console.error("Failed to inject dashboard package:", e);
                }
            }

            // Physical stock deductions are validated and posted before invoice persistence.
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
        bookingId?: string;
        sbId?: string;
    }): Promise<Invoice[]> => {
        await ensureBillingLoaded();
        let result = [...invoices];

        if (filters?.bookingId) {
            result = result.filter(i => i.bookingId === filters.bookingId || i.sbId === filters.bookingId);
        }
        if (filters?.sbId) {
            result = result.filter(i => i.sbId === filters.sbId);
        }
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
                i.invoiceNumber.toLowerCase().includes(q) ||
                i.payments?.some(p => p.referenceNumber.toLowerCase().includes(q))
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
            refundAccountName?: string;
            refundIban?: string;
            refundBankName?: string;
        }
    ): Promise<{ success: boolean; message: string; invoice?: Invoice }> => {
        await ensureBillingLoaded();
        const idx = invoices.findIndex(i => i.id === invoiceId);
        if (idx === -1) return { success: false, message: 'Invoice not found' };

        const inv = invoices[idx];
        if (inv.refundStatus === 'refunded') return { success: false, message: 'Invoice has already been refunded' };

        // For cash/clinic payments, Account Name, IBAN and bank name are required
        if ((inv.paymentMethod === 'cash' || inv.paymentMethod === 'bank_transfer') && (!refundData.refundAccountName || !refundData.refundIban || !refundData.refundBankName)) {
            return { success: false, message: 'Account Name, IBAN and bank name are required for cash/bank transfer refunds' };
        }

        // Mark all items as void
        const voidedItems = inv.items.map(item => ({ ...item, isVoid: true }));

        // Generate Refund Payment Reference if we are actively returning money
        const refundPayments = [...(inv.payments || [])];
        if (refundData.refundAmount > 0) {
            refundPayments.push({
                id: `ref-${Date.now()}`,
                amount: -refundData.refundAmount, // negative marks a refund
                mode: inv.paymentMethod, // usually returned to original
                referenceNumber: generateDocumentNumber('RFD'), // The refund itself is a document, but wait, refund is FMC-RFD-0001
                date: new Date().toISOString()
            });
        }

        invoices[idx] = {
            ...inv,
            items: voidedItems,
            refundStatus: 'refunded',
            refundedAt: new Date().toISOString(),
            refundedBy: refundData.refundedBy,
            refundAmount: refundData.refundAmount,
            refundReason: refundData.refundReason,
            refundAccountName: refundData.refundAccountName,
            refundIban: refundData.refundIban,
            refundBankName: refundData.refundBankName,
            isVoid: true,
            payments: refundPayments
        };

        await saveBilling();
        return { success: true, message: 'Refund processed successfully', invoice: invoices[idx] };
    },
};
