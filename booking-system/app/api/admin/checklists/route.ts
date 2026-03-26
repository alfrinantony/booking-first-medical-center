import { NextResponse } from 'next/server';
import { ChecklistStore } from '@/lib/checklist-store';
import { EquipmentStore } from '@/lib/equipment-store';
import { MedicineStore } from '@/lib/services-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const branchId = searchParams.get('branchId');
    const roomId = searchParams.get('roomId');

    try {
        let checklists = await ChecklistStore.getAll();

        if (date) checklists = checklists.filter(c => c.date === date);
        if (branchId) checklists = checklists.filter(c => c.branchId === branchId);
        if (roomId) checklists = checklists.filter(c => c.roomId === roomId);

        return NextResponse.json(checklists);
    } catch (error) {
        console.error('[Checklists] GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        if (!body.date || !body.branchId || !body.roomId || !body.supervisorName) {
            return NextResponse.json({ error: 'Missing required checklist routing fields' }, { status: 400 });
        }

        // Logic handled purely by the frontend mapping the object structure properly
        const payload = {
            date: body.date,
            branchId: body.branchId,
            roomId: body.roomId,
            supervisorName: body.supervisorName,
            status: body.status || 'Pending',
            pictures: body.pictures || [],
            missingItems: body.missingItems || [],
            remarks: body.remarks || '',
            equipmentChecks: body.equipmentChecks || [],
            consumableChecks: body.consumableChecks || [],
            medicineChecks: body.medicineChecks || [],
        };

        const existing = await ChecklistStore.getByRoomAndDate(body.roomId, body.date);
        if (existing) {
            // Treat as PUT if creating for same room & date
            const updated = await ChecklistStore.update(existing.id, payload);
            return NextResponse.json({ success: true, checklist: updated });
        }

        const newChecklist = await ChecklistStore.add(payload);

        // --- MODULE INTEGRATIONS: Sync stock and equipment upon POST ---
        
        // 1. Sync Equipment Status automatically
        for (const eqCheck of payload.equipmentChecks) {
            const eq = await EquipmentStore.getById(eqCheck.equipmentId);
            if (eq) {
                if (eqCheck.status === 'Issue' && eq.status !== 'damaged') {
                    await EquipmentStore.update(eq.id, { status: 'damaged' });
                } else if (eqCheck.status === 'Maintenance' && eq.status !== 'maintenance') {
                    await EquipmentStore.update(eq.id, { status: 'maintenance' });
                } else if (eqCheck.status === 'Available' && (eq.status === 'damaged' || eq.status === 'maintenance')) {
                    await EquipmentStore.update(eq.id, { status: 'active' });
                }
            }
        }

        // 2. Sync Branch Stock (Deduct refilled items from the global branch stock room into this specific Procedure Room)
        for (const medCheck of payload.medicineChecks) {
            if (medCheck.refilledQty > 0) {
                // The room now 'owns' this stock. Deduct from the global branch shelf to prevent double counting.
                await MedicineStore.deductStock(medCheck.medicineId, medCheck.refilledQty, payload.branchId);
            }
        }

        return NextResponse.json({ success: true, checklist: newChecklist });
    } catch (error) {
        console.error('[Checklists] POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing checklist ID' }, { status: 400 });
        }

        const updated = await ChecklistStore.update(id, updates);
        
        if (updated) {
            return NextResponse.json({ success: true, checklist: updated });
        } else {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('[Checklists] PUT Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing checklist ID' }, { status: 400 });
        }

        const success = await ChecklistStore.remove(id);
        
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('[Checklists] DELETE Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
