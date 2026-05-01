export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    const dbUrl = process.env.DATABASE_URL || '';
    const hiddenUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    return NextResponse.json({ dbUrl: hiddenUrl });
}
