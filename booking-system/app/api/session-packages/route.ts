import { NextRequest, NextResponse } from 'next/server';
import { PackagesStore } from '@/lib/packages-store';
import { ServicesStore } from '@/lib/services-store';

/**
 * GET /api/session-packages?phone=xxx
 * Returns active session packages for the customer.
 *
 * POST /api/session-packages
 * action: 'buy' — Creates a session package for the customer directly from a service's
 * threeSessionPackage or sixSessionPackage configuration.
 */

export async function GET(req: NextRequest) {
    const phone = req.nextUrl.searchParams.get('phone');
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

    const packages = await PackagesStore.getMyPackages(phone);
    return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'buy') {
            const { serviceId, serviceName, sessionCount, price, validity, customerName, customerPhone, paymentMethod } = body;

            if (!serviceId || !serviceName || !sessionCount || !price || !validity || !customerName || !customerPhone) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            const method = paymentMethod === 'pay_at_clinic' ? 'pay_at_clinic' : 'credit_card';

            // Create the package definition
            const pkgName = `${serviceName} - ${sessionCount} Sessions`;
            const pkg = await PackagesStore.createPackage({
                name: pkgName,
                description: `${sessionCount}-session package for ${serviceName}. Valid for ${validity} days at all branches.`,
                price: Number(price),
                validityInDays: Number(validity),
                items: [{ serviceId, serviceName, count: Number(sessionCount) }],
                active: true,
            });

            // Assign to the customer with payment method
            const customerPkg = await PackagesStore.purchasePackage(pkg.id, customerName, customerPhone, method);
            if (!customerPkg) {
                return NextResponse.json({ error: 'Failed to assign package' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                package: customerPkg,
                paymentMethod: method,
                message: method === 'pay_at_clinic'
                    ? `Package reserved! Please visit any branch to complete payment.`
                    : `Successfully purchased ${sessionCount} sessions of ${serviceName}!`,
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('Session packages API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
