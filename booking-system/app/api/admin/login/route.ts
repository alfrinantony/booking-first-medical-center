import { NextRequest, NextResponse } from 'next/server';
import { UsersStore, CLINICS } from '@/lib/users-store';
import type { LoginRestrictions } from '@/lib/users-types';
import { HRAttendanceStore } from '@/lib/hr-attendance-store';

// ── Haversine distance (meters) ──
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Get Dubai time (UTC+4) ──
function getDubaiTime(): { hours: number; minutes: number; dayOfWeek: number; dateStr: string } {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const dubaiMs = utcMs + 4 * 3600000; // UTC+4
    const dubai = new Date(dubaiMs);
    return {
        hours: dubai.getHours(),
        minutes: dubai.getMinutes(),
        dayOfWeek: dubai.getDay(), // 0=Sun .. 6=Sat
        dateStr: dubai.toISOString().split('T')[0], // YYYY-MM-DD
    };
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export async function POST(req: NextRequest) {
    try {
        const { username, password, latitude, longitude } = await req.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const user = await UsersStore.login(username, password);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // ── Enforce login restrictions (SUPER_ADMIN is always exempt) ──
        const r = user.loginRestrictions;
        if (r && r.enabled && user.role !== 'SUPER_ADMIN') {
            // Get client IP from headers
            const clientIP =
                req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                req.headers.get('x-real-ip') ||
                'unknown';

            // 1. Country restriction
            if (r.allowedCountries && r.allowedCountries.length > 0) {
                try {
                    const geoRes = await fetch(`http://ip-api.com/json/${clientIP}?fields=countryCode`, {
                        signal: AbortSignal.timeout(3000),
                    });
                    if (geoRes.ok) {
                        const geo = await geoRes.json();
                        if (geo.countryCode && !r.allowedCountries.includes(geo.countryCode)) {
                            return NextResponse.json(
                                { error: `Login restricted: your country (${geo.countryCode}) is not allowed` },
                                { status: 403 }
                            );
                        }
                    }
                } catch {
                    // IP lookup failed — skip country check on error
                }
            }

            // 2. IP Address restriction
            if (r.allowedIPs && r.allowedIPs.length > 0) {
                if (!r.allowedIPs.includes(clientIP)) {
                    return NextResponse.json(
                        { error: 'Login restricted: your IP address is not allowed' },
                        { status: 403 }
                    );
                }
            }

            // 3. Geofence restriction
            if (r.geofence && r.geofence.enabled) {
                if (latitude == null || longitude == null) {
                    return NextResponse.json(
                        { error: 'Login restricted: location access is required. Please enable location services and try again.' },
                        { status: 403 }
                    );
                }
                const branch = CLINICS.find(c => c.id === r.geofence!.branchId);
                if (branch) {
                    const distance = haversineDistance(latitude, longitude, branch.lat, branch.lng);
                    if (distance > r.geofence.radiusMeters) {
                        return NextResponse.json(
                            { error: `Login restricted: you are ${Math.round(distance)}m from ${branch.name} (max ${r.geofence.radiusMeters}m)` },
                            { status: 403 }
                        );
                    }
                }
            }

            // 4. Time window restriction
            if (r.timeWindow && r.timeWindow.enabled) {
                const dubai = getDubaiTime();
                const nowMin = dubai.hours * 60 + dubai.minutes;
                const startMin = timeToMinutes(r.timeWindow.startTime);
                const endMin = timeToMinutes(r.timeWindow.endTime);

                // Check day of week
                if (!r.timeWindow.allowedDays.includes(dubai.dayOfWeek)) {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    return NextResponse.json(
                        { error: `Login restricted: not allowed on ${dayNames[dubai.dayOfWeek]}` },
                        { status: 403 }
                    );
                }

                // Check time range
                if (nowMin < startMin || nowMin > endMin) {
                    return NextResponse.json(
                        { error: `Login restricted: allowed only between ${r.timeWindow.startTime} and ${r.timeWindow.endTime} (Dubai time)` },
                        { status: 403 }
                    );
                }
            }

            // 5. Attendance-based restriction
            if (r.requireAttendance && user.employeeId) {
                const dubai = getDubaiTime();
                const todayRecords = await HRAttendanceStore.getAll({
                    employeeId: user.employeeId,
                    date: dubai.dateStr,
                });
                const hasPunchedIn = todayRecords.some(
                    rec => rec.punchIn !== null && ['PRESENT', 'LATE', 'HALF_DAY', 'EARLY_LEAVE'].includes(rec.status)
                );
                if (!hasPunchedIn) {
                    return NextResponse.json(
                        { error: 'Login restricted: you must punch in attendance before logging in' },
                        { status: 403 }
                    );
                }
            }
        }

        // Return user without password (sessionToken is included)
        const { password: _pw, ...safeUser } = user;
        return NextResponse.json(safeUser);
    } catch {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
