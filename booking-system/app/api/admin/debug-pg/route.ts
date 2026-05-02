export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$connect();
        const clients = await prisma.client.count();
        return NextResponse.json({ ok: true, count: clients });
    } catch (error: any) {
        return NextResponse.json({ 
            ok: false, 
            name: error.name,
            message: error.message,
            code: error.errorCode,
            stack: error.stack
        }, { status: 200 }); // RETURN 200 SO WE CAN SEE THE JSON!!
    }
}
