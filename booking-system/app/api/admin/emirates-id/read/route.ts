import { NextResponse } from 'next/server';
import { readEmiratesId, mapToClientForm } from '@/lib/emirates-id';

export async function GET() {
    try {
        const result = await readEmiratesId();

        if (!result.success || !result.data) {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to read Emirates ID card.',
            }, { status: 400 });
        }

        const formFields = mapToClientForm(result.data);

        return NextResponse.json({
            success: true,
            isDemo: result.isDemo || false,
            raw: result.data,
            formFields,
        });
    } catch (error) {
        console.error('[Emirates ID API] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error while reading Emirates ID.',
        }, { status: 500 });
    }
}
