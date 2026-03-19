import { NextRequest, NextResponse } from 'next/server';
import { PackagesStore } from '@/lib/packages-store';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | undefined;
    
    try {
        const requests = await PackagesStore.getTransferRequests(status);
        return NextResponse.json(requests);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch transfer requests' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { customerPackageId, fromCustomerPhone, fromCustomerName, toCustomerPhone, toCustomerName, reason } = body;

        if (!customerPackageId || !fromCustomerPhone || !toCustomerPhone || !toCustomerName || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const res = await PackagesStore.createTransferRequest(
            customerPackageId,
            fromCustomerPhone,
            fromCustomerName || 'Guest',
            toCustomerPhone,
            toCustomerName,
            reason
        );

        if (!res.success) {
            return NextResponse.json({ error: res.message }, { status: 400 });
        }
        return NextResponse.json(res.request, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 });
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

        const res = await PackagesStore.resolveTransferRequest(requestId, status, adminName);
        if (!res.success) {
            return NextResponse.json({ error: res.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: res.message });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to resolve transfer request' }, { status: 500 });
    }
}
