import { NextResponse } from 'next/server';
import { ContractsStore } from '@/lib/contracts-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');

    if (clinicId) {
        return NextResponse.json(ContractsStore.getByClinic(clinicId));
    }
    return NextResponse.json(ContractsStore.getAll());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clinicId, contractType, contractTitle, contractAmount, startDate, endDate } = body;

        if (!clinicId || !contractType || !contractTitle || !contractAmount || !startDate || !endDate) {
            return NextResponse.json({ error: 'Required fields: clinicId, contractType, contractTitle, contractAmount, startDate, endDate' }, { status: 400 });
        }

        const contract = ContractsStore.add({
            ...body,
            contractAmount: Number(contractAmount),
            numberOfCheques: body.numberOfCheques ? Number(body.numberOfCheques) : undefined,
            cashInstallment: body.cashInstallment ? Number(body.cashInstallment) : undefined,
        });

        return NextResponse.json(contract);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
        }

        if (updates.contractAmount) updates.contractAmount = Number(updates.contractAmount);
        if (updates.numberOfCheques) updates.numberOfCheques = Number(updates.numberOfCheques);
        if (updates.cashInstallment) updates.cashInstallment = Number(updates.cashInstallment);

        const updated = ContractsStore.update(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
        }

        const success = ContractsStore.remove(id);
        if (!success) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
