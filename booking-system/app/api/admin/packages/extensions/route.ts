import { NextRequest, NextResponse } from 'next/server';
import { PackagesStore } from '@/lib/packages-store';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | undefined;
    
    try {
        const requests = await PackagesStore.getExtensionRequests(status);
        return NextResponse.json(requests);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch extension requests' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { customerPackageId, customerPhone, customerName, reason, documentUrl, requestedDays } = body;

        if (!customerPackageId || !customerPhone || !reason || !documentUrl || !requestedDays) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const res = await PackagesStore.createExtensionRequest(
            customerPackageId,
            customerPhone,
            customerName || 'Guest',
            reason as 'medical' | 'pregnancy_breastfeeding',
            documentUrl,
            Number(requestedDays)
        );

        if (!res.success) {
            return NextResponse.json({ error: res.message }, { status: 400 });
        }
        return NextResponse.json(res.request, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create extension request' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestId, status, adminName } = body;

        if (!requestId || !status || !adminName) {
            return NextResponse.json({ error: 'Missing requestId, status, or adminName' }, { status: 400 });
        }

        if (status !== 'approved' && status !== 'rejected') {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const res = await PackagesStore.resolveExtensionRequest(requestId, status, adminName);
        if (!res.success) {
            return NextResponse.json({ error: res.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: res.message });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to resolve extension request' }, { status: 500 });
    }
}
