import { NextResponse } from 'next/server';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';
import { HRStore } from '@/lib/hr-store';
import { ZKTecoService } from '@/lib/zkteco-service';

// POST /api/admin/hr/attendance/sync — Trigger sync from ZKTeco device
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const config = {
            host: body.host || '192.168.1.200',
            port: body.port || 4370,
            username: body.username || 'admin',
            password: body.password || 'admin',
            deviceSn: body.deviceSn || 'SFVL-2024-00001',
        };

        // Build employee code → id map
        const employees = await HRStore.getAll({ status: 'ACTIVE' });
        const employeeMap: Record<string, string> = {};
        for (const emp of employees) {
            employeeMap[emp.employeeCode] = emp.id;
        }

        const result = await ZKTecoService.syncAttendance(
            config,
            employeeMap,
            async (records) => HRAttendanceStore.bulkImport(records),
            {
                startDate: body.startDate,
                endDate: body.endDate,
            }
        );

        // Update device last sync
        const devices = await HRAttendanceStore.getDevices();
        if (devices.length > 0) {
            await HRAttendanceStore.updateDevice(devices[0].id, {
                lastSync: result.syncedAt,
                status: result.success ? 'ONLINE' : 'OFFLINE',
            });
        }

        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}

// GET /api/admin/hr/attendance/sync — Get last sync info
export async function GET() {
    const devices = await HRAttendanceStore.getDevices();
    const primaryDevice = devices[0] || null;

    return NextResponse.json({
        lastSync: primaryDevice?.lastSync || null,
        deviceStatus: primaryDevice?.status || 'UNKNOWN',
        autoSyncEnabled: primaryDevice?.autoSyncEnabled || false,
        autoSyncInterval: primaryDevice?.autoSyncIntervalMinutes || 15,
    });
}
