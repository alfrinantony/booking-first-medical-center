export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BillingStore } from '@/lib/billing-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const clientPhone = searchParams.get('clientPhone') || undefined;
    const clientEmail = searchParams.get('clientEmail') || undefined;
    const clinicId = searchParams.get('clinicId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const invoiceNumber = searchParams.get('invoiceNumber') || undefined;
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const search = searchParams.get('search') || undefined;
    const refundStatus = searchParams.get('refundStatus') || undefined;
    const id = searchParams.get('id') || undefined;

    if (id) {
        const invoice = await BillingStore.getInvoiceById(id);
        if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(invoice);
    }

    const invoices = await BillingStore.getInvoices({
        clientPhone, clientEmail, clinicId, dateFrom, dateTo,
        invoiceNumber, paymentMethod, search, refundStatus,
    });
    return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
    const data = await req.json();

    // Handle refund action
    if (data.action === 'refund') {
        const { invoiceId, refundedBy, refundAmount, refundReason, refundIban, refundBankName } = data;
        if (!invoiceId || !refundedBy || refundAmount === undefined || !refundReason) {
            return NextResponse.json({ error: 'Missing required refund fields' }, { status: 400 });
        }
        const result = await BillingStore.refundInvoice(invoiceId, {
            refundedBy, refundAmount, refundReason, refundIban, refundBankName,
        });
        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }
        return NextResponse.json(result);
    }

    // Default: create invoice
    const invoice = await BillingStore.createInvoice(data);
    return NextResponse.json(invoice);
}
