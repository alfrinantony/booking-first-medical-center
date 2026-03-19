export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const data = await req.json();

        // Log the data to assume it's being sent to an external CRM endpoint
        console.log('--- CRM INTEGRATION STUB ---');
        console.log('Pushing data to High Level CRM / Medical Software...');
        console.log('Payload:', data);
        console.log('----------------------------');

        // Simulate successful response from external system
        return NextResponse.json({
            success: true,
            message: 'Data successfully synced with CRM',
            externalId: 'crm_' + Date.now()
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to sync with CRM' },
            { status: 500 }
        );
    }
}
