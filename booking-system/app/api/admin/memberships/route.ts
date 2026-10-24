export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { MembershipsStore } from '@/lib/memberships-store';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'tiers';
        const phone = searchParams.get('phone') || undefined;
        const customerName = searchParams.get('customerName') || undefined;
        const status = searchParams.get('status') || undefined;
        const includeInactive = searchParams.get('includeInactive') === 'true';

        if (type === 'tiers') {
            const tiers = await MembershipsStore.getTiers(includeInactive);
            return NextResponse.json(tiers);
        }

        if (type === 'privileges') {
            const privileges = await MembershipsStore.getPrivileges(includeInactive);
            return NextResponse.json(privileges);
        }

        if (type === 'customer' || type === 'my' || type === 'all-customer') {
            const memberships = await MembershipsStore.getCustomerMemberships({
                phone,
                customerName,
                status
            });
            return NextResponse.json(memberships);
        }

        const tiers = await MembershipsStore.getTiers(includeInactive);
        return NextResponse.json(tiers);
    } catch (error: any) {
        console.error('[API Memberships GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'createTier': {
                const tier = await MembershipsStore.createTier(body.data);
                return NextResponse.json({ success: true, tier });
            }
            case 'updateTier': {
                const updated = await MembershipsStore.updateTier(body.id, body.updates);
                return NextResponse.json({ success: true, tier: updated });
            }
            case 'deleteTier': {
                const deleted = await MembershipsStore.deleteTier(body.id);
                return NextResponse.json({ success: deleted });
            }
            case 'assign': {
                const result = await MembershipsStore.assignMembership(body.data);
                return NextResponse.json({ success: true, ...result });
            }
            case 'useProcedure': {
                const result = await MembershipsStore.useProcedureSession(
                    body.customerMembershipId,
                    body.serviceId,
                    body.details || {}
                );
                return NextResponse.json(result);
            }
            case 'updateStatus': {
                const success = await MembershipsStore.updateCustomerMembershipStatus(
                    body.id,
                    body.status,
                    body.staffName
                );
                return NextResponse.json({ success });
            }
            case 'deleteCustomerMembership': {
                const success = await MembershipsStore.deleteCustomerMembership(body.id);
                return NextResponse.json({ success });
            }
            case 'createPrivilege': {
                const privilege = await MembershipsStore.createPrivilege(body.data);
                return NextResponse.json({ success: true, privilege });
            }
            case 'updatePrivilege': {
                const updated = await MembershipsStore.updatePrivilege(body.id, body.updates);
                return NextResponse.json({ success: true, privilege: updated });
            }
            case 'deletePrivilege': {
                const deleted = await MembershipsStore.deletePrivilege(body.id);
                return NextResponse.json({ success: deleted });
            }
            case 'togglePrivilege': {
                const updated = await MembershipsStore.togglePrivilege(body.id);
                return NextResponse.json({ success: true, privilege: updated });
            }
            default:
                return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[API Memberships POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
