import { NextResponse } from 'next/server';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';
import { ZKTecoService } from '@/lib/zkteco-service';

// GET /api/admin/hr/attendance/device — Get device info & status
export async function GET() {
    const devices = await HRAttendanceStore.getDevices();

    // Get live status for each device
    const enriched = await Promise.all(
        devices.map(async (device) => {
            const status = await ZKTecoService.testConnection({
                host: device.host,
                port: device.port,
                username: 'admin',
                password: 'admin',
                deviceSn: device.serialNumber,
            });

            return {
                ...device,
                liveStatus: status.success ? 'ONLINE' : 'OFFLINE',
                deviceInfo: status.device || null,
            };
        })
    );

    return NextResponse.json(enriched);
}

// POST /api/admin/hr/attendance/device — Add/update/test device
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        // Test connection
        if (action === 'test') {
            const result = await ZKTecoService.testConnection({
                host: body.host || '192.168.1.200',
                port: body.port || 4370,
                username: body.username || 'admin',
                password: body.password || 'admin',
                deviceSn: body.deviceSn || '',
            });
            return NextResponse.json(result);
        }

        // Update existing device
        if (action === 'update' && body.id) {
            const updated = await HRAttendanceStore.updateDevice(body.id, {
                name: body.name,
                serialNumber: body.serialNumber,
                host: body.host,
                port: body.port,
                autoSyncEnabled: body.autoSyncEnabled,
                autoSyncIntervalMinutes: body.autoSyncIntervalMinutes,
            });
            if (!updated) {
                return NextResponse.json({ error: 'Device not found' }, { status: 404 });
            }
            return NextResponse.json(updated);
        }

        // Add new device
        if (action === 'add') {
            const device = await HRAttendanceStore.addDevice({
                name: body.name || 'New Device',
                serialNumber: body.serialNumber || '',
                host: body.host || '',
                port: body.port || 4370,
                autoSyncEnabled: body.autoSyncEnabled || false,
                autoSyncIntervalMinutes: body.autoSyncIntervalMinutes || 15,
            });
            return NextResponse.json(device, { status: 201 });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

// DELETE /api/admin/hr/attendance/device — Remove device
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Device id is required' }, { status: 400 });
    }

    const deleted = await HRAttendanceStore.removeDevice(id);
    if (!deleted) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
