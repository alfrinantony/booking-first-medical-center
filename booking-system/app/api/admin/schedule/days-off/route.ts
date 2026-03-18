import { NextResponse } from 'next/server';
import { ServicesStore } from '@/lib/services-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { doctorId, daysOff } = body;

        if (!doctorId || !Array.isArray(daysOff)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const success = await ServicesStore.setGlobalDaysOff(doctorId, daysOff);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
