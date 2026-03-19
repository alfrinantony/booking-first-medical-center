export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyStore } from '@/lib/loyalty-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone') || undefined;

    if (phone) {
        const [balance, history] = await Promise.all([
            LoyaltyStore.getBalance(phone),
            LoyaltyStore.getHistory(phone),
        ]);
        return NextResponse.json({ balance, history });
    }

    const transactions = await LoyaltyStore.getAllTransactions();
    return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, customerPhone, points, description, netAmount, redeemAmountAED } = body;

    switch (action) {
        case 'manual_adjustment':
            await LoyaltyStore.addManualAdjustment(customerPhone, points, description);
            return NextResponse.json({ success: true });
        case 'referral_reward':
            await LoyaltyStore.addReferralReward(customerPhone, netAmount);
            return NextResponse.json({ success: true });
        case 'service_earning':
            await LoyaltyStore.addServiceEarning(customerPhone, netAmount);
            return NextResponse.json({ success: true });
        case 'redeem':
            const result = await LoyaltyStore.redeemPoints(customerPhone, redeemAmountAED);
            return NextResponse.json(result);
        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
}
