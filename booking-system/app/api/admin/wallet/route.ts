import { NextResponse } from 'next/server';
import { WalletStore } from '@/lib/wallet-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    try {
        const wallet = await WalletStore.getWallet(phone);
        return NextResponse.json(wallet || { balance: 0, transactions: [], restrictedBalances: [] });
    } catch (error) {
        console.error('Failed to get wallet:', error);
        return NextResponse.json({ error: 'Failed to Fetch Wallet' }, { status: 500 });
    }
}
