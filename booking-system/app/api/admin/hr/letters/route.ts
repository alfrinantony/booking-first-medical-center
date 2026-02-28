import { NextResponse } from 'next/server';
import { HRLettersStore } from '@/lib/hr-letters-store';
import type { LetterType, LetterStatus } from '@/lib/hr-letters-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || undefined;
    const status = searchParams.get('status') as LetterStatus | undefined;
    const letterType = searchParams.get('letterType') as LetterType | undefined;

    const letters = HRLettersStore.getAll({ employeeId, status, letterType });
    return NextResponse.json(letters);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, letterType, generatedBy, issuedDate, endDate, sickLeavesTaken, disciplinaryActions } = body;

        if (!employeeId || !letterType || !issuedDate) {
            return NextResponse.json({ error: 'employeeId, letterType, and issuedDate are required' }, { status: 400 });
        }

        const letter = HRLettersStore.generate({
            employeeId,
            letterType,
            generatedBy: generatedBy || 'HR Department',
            issuedDate,
            endDate,
            sickLeavesTaken: sickLeavesTaken !== undefined ? Number(sickLeavesTaken) : undefined,
            disciplinaryActions,
        });

        if (!letter) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        return NextResponse.json(letter, { status: 201 });
    } catch (err) {
        console.error('[HR Letters] Error:', err);
        return NextResponse.json({ error: 'Failed to generate letter' }, { status: 500 });
    }
}
