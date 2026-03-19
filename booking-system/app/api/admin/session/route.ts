export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { UsersStore } from '@/lib/users-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    if (!userId || !token) {
        return NextResponse.json({ valid: false }, { status: 400 });
    }

    const valid = await UsersStore.validateSession(userId, token);
    return NextResponse.json({ valid });
}
