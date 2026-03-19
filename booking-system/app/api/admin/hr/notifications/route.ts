export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRDocumentsStore } from '@/lib/hr-documents-store';
import { HRStore } from '@/lib/hr-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const withinDays = parseInt(searchParams.get('days') || '30', 10);

    // Get expiring soon
    const expiringSoon = HRDocumentsStore.getExpiringSoon(withinDays);

    // Get already expired
    const expired = HRDocumentsStore.getExpired();

    // Enrich with employee names
    const enriched = async (items: typeof expiringSoon | typeof expired) =>
        Promise.all(items.map(async doc => {
            const employee = await HRStore.getById(doc.employeeId);
            return {
                ...doc,
                employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
                employeeCode: employee?.employeeCode || '',
            };
        }));

    return NextResponse.json({
        expiringSoon: await enriched(expiringSoon),
        expired: await enriched(expired as any),
        summary: {
            expiringSoonCount: expiringSoon.length,
            expiredCount: expired.length,
            totalAlerts: expiringSoon.length + expired.length,
        },
    });
}
