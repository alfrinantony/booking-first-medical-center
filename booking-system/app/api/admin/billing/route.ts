import { NextRequest, NextResponse } from 'next/server';
import { BillingStore } from '@/lib/billing-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const clientPhone = searchParams.get('clientPhone') || undefined;
    const clinicId = searchParams.get('clinicId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const id = searchParams.get('id') || undefined;

    if (id) {
        const invoice = await BillingStore.getInvoiceById(id);
        if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(invoice);
    }

    const invoices = await BillingStore.getInvoices({ clientPhone, clinicId, dateFrom, dateTo });
    return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
    const data = await req.json();
    const invoice = await BillingStore.createInvoice(data);
    return NextResponse.json(invoice);
}
