import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InvoiceLineItem {
    description: string;       // Service name or package name
    quantity: number;
    unitPrice: number;
    total: number;
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

interface BillingState {
    invoices: Invoice[];
    nextSequence: number;

    createInvoice: (data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>) => Invoice;
    getInvoices: (filters?: { clientPhone?: string; clinicId?: string; dateFrom?: string; dateTo?: string }) => Invoice[];
    getInvoiceById: (id: string) => Invoice | undefined;
}

export const useBillingStore = create<BillingState>()(
    persist(
        (set, get) => ({
            invoices: [],
            nextSequence: 1,

            createInvoice: (data) => {
                const state = get();
                const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const seqStr = String(state.nextSequence).padStart(4, '0');
                const invoiceNumber = `BFMC-INV-${today}-${seqStr}`;

                const invoice: Invoice = {
                    ...data,
                    id: `inv-${Date.now()}`,
                    invoiceNumber,
                    createdAt: new Date().toISOString(),
                };

                set(s => ({
                    invoices: [...s.invoices, invoice],
                    nextSequence: s.nextSequence + 1,
                }));

                return invoice;
            },

            getInvoices: (filters) => {
                let result = get().invoices;

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

            getInvoiceById: (id) => {
                return get().invoices.find(i => i.id === id);
            },
        }),
        {
            name: 'billing-store',
        }
    )
);
