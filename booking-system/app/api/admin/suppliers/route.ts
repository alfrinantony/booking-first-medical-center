import { NextResponse } from 'next/server';
import { SupplierStore } from '@/lib/services-store';

export async function GET() {
    return NextResponse.json(SupplierStore.getAll());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, contactPerson, phone, email, address, bankName, iban, trn, chequeDaysAfterDelivery, tradeLicenseNumber, tradeLicenseExpiry, companyNumber, faxNumber, tradeLicenseBase64, tradeLicenseName } = body;
        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        const supplier = SupplierStore.add({ name, contactPerson, phone, email, address, bankName, iban, trn, chequeDaysAfterDelivery, tradeLicenseNumber, tradeLicenseExpiry, companyNumber, faxNumber, tradeLicenseBase64, tradeLicenseName });
        return NextResponse.json(supplier);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;
        if (!id) {
            return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
        }
        const updated = SupplierStore.update(id, updates);
        if (updated) return NextResponse.json(updated);
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
        }
        const success = SupplierStore.remove(id);
        if (success) return NextResponse.json({ success: true });
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
