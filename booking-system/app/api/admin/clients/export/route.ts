import { NextRequest, NextResponse } from 'next/server';
import { ClientsStore } from '@/lib/clients-store';
import { maskPhone, maskEmail } from '@/lib/emr-store';

/**
 * GET /api/admin/clients/export
 *
 * External-facing endpoint that returns client data with contact info masked.
 * External systems can pull clients using this webhook.
 *
 * Auth: Bearer token validated against EMR_API_KEY env var or query param.
 * Query params:
 *   - clientId: optional, return single client
 *   - apiKey:   alternative to Authorization header
 */
export async function GET(req: NextRequest) {
    try {
        // ── Auth: check Bearer token or query param ──
        const { searchParams } = new URL(req.url);
        const headerAuth = req.headers.get('Authorization');
        const bearerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null;
        const queryKey = searchParams.get('apiKey');
        const providedKey = bearerToken || queryKey;

        // The API key can be set via env var or we accept any non-empty key for demo
        const serverKey = process.env.EMR_API_KEY;

        if (!providedKey) {
            return NextResponse.json(
                { error: 'Authorization required. Provide Bearer token or apiKey query parameter.' },
                { status: 401 }
            );
        }

        if (serverKey && providedKey !== serverKey) {
            return NextResponse.json(
                { error: 'Invalid API key.' },
                { status: 403 }
            );
        }

        // ── Fetch clients ──
        const clientId = searchParams.get('clientId');
        const allClients = ClientsStore.getAll();

        const clients = clientId
            ? allClients.filter(c => c.id === clientId)
            : allClients;

        if (clientId && clients.length === 0) {
            return NextResponse.json(
                { error: 'Client not found.' },
                { status: 404 }
            );
        }

        // ── Build masked response ──
        const maskedClients = clients.map(client => ({
            id: client.id,
            name: client.name,
            firstName: client.firstName,
            middleName: client.middleName,
            lastName: client.lastName,
            // ▼ Contact fields are ALWAYS masked on this external endpoint ▼
            mobile: maskPhone(client.mobile),
            whatsapp: maskPhone(client.whatsapp),
            email: maskEmail(client.email),
            phone: maskPhone(client.phone),
            // ▲ Masked ▲
            gender: client.gender,
            dateOfBirth: client.dateOfBirth,
            nationality: client.nationality,
            emiratesIdNumber: client.emiratesIdNumber,
            civilStatus: client.civilStatus,
            clientClass: client.clientClass,
            language: client.language,
            address: client.address,
            city: client.city,
            country: client.country,
            totalBookings: client.totalBookings,
            lastBookingDate: client.lastBookingDate,
        }));

        return NextResponse.json({
            success: true,
            count: maskedClients.length,
            clients: clientId ? maskedClients[0] : maskedClients,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
