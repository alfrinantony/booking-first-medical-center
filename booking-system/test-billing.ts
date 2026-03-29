import { BillingStore } from './lib/billing-store';

async function test() {
    try {
        const invoice = await BillingStore.createInvoice({
            invoiceCategory: 'clinic_single',
            clientName: 'Test Client',
            clientPhone: '123456789',
            items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100, consumptions: [] }],
            subtotal: 100,
            taxPercentage: 5,
            taxAmount: 5,
            totalAmount: 105,
            paymentMethod: 'card',
            paymentConfirmed: true,
            generatedBy: 'Admin',
            date: '2026-03-29'
        });
        console.log("Invoice created successfully:");
        console.log(invoice);
    } catch (e) {
        console.error("Error creating invoice:");
        console.error(e);
    }
}

test();
