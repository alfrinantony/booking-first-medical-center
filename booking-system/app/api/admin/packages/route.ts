import { NextRequest, NextResponse } from 'next/server';
import { PackagesStore } from '@/lib/packages-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone') || undefined;
    const type = searchParams.get('type') || 'available'; // 'available' | 'customer' | 'my'

    if (type === 'customer' && phone) {
        const packages = await PackagesStore.getCustomerPackages(phone);
        return NextResponse.json(packages);
    }
    if (type === 'my' && phone) {
        const packages = await PackagesStore.getMyPackages(phone);
        return NextResponse.json(packages);
    }
    if (type === 'all-customer') {
        const packages = await PackagesStore.getAllCustomerPackages();
        return NextResponse.json(packages);
    }

    const packages = await PackagesStore.getAvailablePackages();
    return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    switch (action) {
        case 'create':
            const pkg = await PackagesStore.createPackage(body.data);
            return NextResponse.json(pkg);
        case 'update':
            await PackagesStore.updatePackage(body.id, body.updates);
            return NextResponse.json({ success: true });
        case 'delete':
            await PackagesStore.deletePackage(body.id);
            return NextResponse.json({ success: true });
        case 'purchase':
            const result = await PackagesStore.purchasePackage(body.packageId, body.customerName, body.customerPhone);
            return NextResponse.json(result || { error: 'Package not found' });
        case 'useSession':
            return NextResponse.json(await PackagesStore.useSession(body.customerPackageId, body.serviceId));
        case 'transfer':
            return NextResponse.json(await PackagesStore.transferPackage(body.customerPkgId, body.newOwnerName, body.newOwnerPhone, body.reason));
        case 'freeze':
            return NextResponse.json(await PackagesStore.freezePackage(body.customerPkgId, body.reason, body.documentName));
        case 'unfreeze':
            return NextResponse.json(await PackagesStore.unfreezePackage(body.customerPkgId));
        case 'adjust':
            return NextResponse.json(await PackagesStore.adjustPartialPackage(body.customerPkgId, body.sessionsUsed, body.singleSessionDiscountedPrice));
        case 'addComplimentary':
            return NextResponse.json(await PackagesStore.addComplimentaryService(body.customerPkgId, body.serviceId, body.serviceName));
        case 'useComplimentary':
            return NextResponse.json(await PackagesStore.useComplimentaryService(body.customerPkgId, body.serviceIndex, body.recipientPhone));
        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
}
