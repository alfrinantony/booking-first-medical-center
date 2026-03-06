// ─────────────────────────────────────────────────────────────
// ZKTeco SpeedFace-V5L API Integration Service
// Uses ZKBioAccess IVS / BioTime REST API patterns
// Includes simulation mode for dev/demo
// ─────────────────────────────────────────────────────────────

export interface ZKTecoConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    deviceSn: string;
}

export interface ZKTecoTransaction {
    id: string;
    empCode: string;
    punchTime: string;   // ISO datetime
    punchType: 'IN' | 'OUT';
    deviceSn: string;
    verifyMode: 'FACE' | 'FINGERPRINT' | 'CARD' | 'PASSWORD';
}

export interface ZKTecoDeviceStatus {
    serialNumber: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    lastActivity: string;
    firmwareVersion: string;
    ipAddress: string;
    enrolledUsers: number;
}

export interface ZKTecoSyncResult {
    success: boolean;
    transactionsFound: number;
    newRecordsImported: number;
    duplicatesSkipped: number;
    errors: string[];
    syncedAt: string;
}

// ── Auth token cache ──
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// ── API Base Functions ──
async function getBaseUrl(config: ZKTecoConfig): Promise<string> {
    return `http://${config.host}:${config.port}`;
}

async function authenticate(config: ZKTecoConfig): Promise<string> {
    // Return cached token if still valid
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const baseUrl = await getBaseUrl(config);
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: config.username,
                password: config.password,
            }),
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        cachedToken = data.token || data.access_token;
        tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
        return cachedToken!;
    } catch (error) {
        throw new Error(`ZKTeco authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ── Simulation Mode ──
// When the device is not physically available, generates realistic mock data

function generateSimulatedTransactions(employeeCodes: string[], date: string): ZKTecoTransaction[] {
    const transactions: ZKTecoTransaction[] = [];

    for (const code of employeeCodes) {
        // Random punch-in between 8:40-9:30
        const inHour = 8 + Math.floor(Math.random() * 2);
        const inMin = Math.floor(Math.random() * 60);
        const inTime = `${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}`;

        // Random punch-out between 17:00-18:30
        const outHour = 17 + Math.floor(Math.random() * 2);
        const outMin = Math.floor(Math.random() * 60);
        const outTime = `${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}`;

        // 10% chance of absent (no record)
        if (Math.random() < 0.1) continue;

        transactions.push(
            {
                id: `txn-${code}-${date}-in`,
                empCode: code,
                punchTime: `${date}T${inTime}:00Z`,
                punchType: 'IN',
                deviceSn: 'SFVL-2024-00001',
                verifyMode: 'FACE',
            },
            {
                id: `txn-${code}-${date}-out`,
                empCode: code,
                punchTime: `${date}T${outTime}:00Z`,
                punchType: 'OUT',
                deviceSn: 'SFVL-2024-00001',
                verifyMode: 'FACE',
            }
        );
    }

    return transactions;
}

// ── ZKTeco Service ──
export const ZKTecoService = {
    /**
     * Test connection to the ZKTeco device
     */
    async testConnection(config: ZKTecoConfig): Promise<{ success: boolean; message: string; device?: ZKTecoDeviceStatus }> {
        // Simulation mode
        if (!config.host || config.host === '192.168.1.200') {
            return {
                success: true,
                message: 'Connected to device (Simulation Mode)',
                device: {
                    serialNumber: config.deviceSn || 'SFVL-2024-00001',
                    name: 'SpeedFace-V5L — Main Entrance',
                    status: 'ONLINE',
                    lastActivity: new Date().toISOString(),
                    firmwareVersion: 'V2.1.3-20240215',
                    ipAddress: config.host,
                    enrolledUsers: 45,
                },
            };
        }

        try {
            const token = await authenticate(config);
            const baseUrl = await getBaseUrl(config);

            const response = await fetch(`${baseUrl}/api/device/${config.deviceSn}/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error(`Device status check failed: ${response.status}`);

            const device = await response.json();
            return {
                success: true,
                message: 'Connected successfully',
                device: {
                    serialNumber: device.sn || config.deviceSn,
                    name: device.alias || device.name || 'SpeedFace-V5L',
                    status: device.state === 1 ? 'ONLINE' : 'OFFLINE',
                    lastActivity: device.last_activity || new Date().toISOString(),
                    firmwareVersion: device.firmware_version || 'Unknown',
                    ipAddress: device.ip_address || config.host,
                    enrolledUsers: device.user_count || 0,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    },

    /**
     * Fetch attendance transactions from device
     */
    async fetchTransactions(
        config: ZKTecoConfig,
        options?: { startDate?: string; endDate?: string; employeeCodes?: string[] }
    ): Promise<ZKTecoTransaction[]> {
        // Simulation mode
        if (!config.host || config.host === '192.168.1.200') {
            const date = options?.startDate || new Date().toISOString().split('T')[0];
            const codes = options?.employeeCodes || ['FMC-001', 'FMC-002', 'FMC-003'];
            return generateSimulatedTransactions(codes, date);
        }

        try {
            const token = await authenticate(config);
            const baseUrl = await getBaseUrl(config);

            const params = new URLSearchParams();
            if (options?.startDate) params.set('start_date', options.startDate);
            if (options?.endDate) params.set('end_date', options.endDate);

            const response = await fetch(
                `${baseUrl}/api/transaction/device/${config.deviceSn}?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error(`Fetch transactions failed: ${response.status}`);

            const data = await response.json();
            const rawTransactions = data.data || data.results || data;

            return (Array.isArray(rawTransactions) ? rawTransactions : []).map((t: Record<string, unknown>) => ({
                id: String(t.id || `txn-${Date.now()}-${Math.random()}`),
                empCode: String(t.emp_code || t.person_id || ''),
                punchTime: String(t.punch_time || t.event_time || ''),
                punchType: (Number(t.punch_state) === 0 || String(t.direction) === 'in') ? 'IN' as const : 'OUT' as const,
                deviceSn: String(t.terminal_sn || config.deviceSn),
                verifyMode: mapVerifyMode(Number(t.verify_type)),
            }));
        } catch (error) {
            throw new Error(`ZKTeco fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Process raw transactions into attendance records
     * Groups by employee+date, picks earliest IN and latest OUT
     */
    processTransactions(transactions: ZKTecoTransaction[], employeeMap: Record<string, string>): {
        employeeId: string;
        date: string;
        punchIn: string | null;
        punchOut: string | null;
        source: 'BIOMETRIC';
        notes: string;
    }[] {
        // Group by employee code + date
        const groups: Record<string, ZKTecoTransaction[]> = {};

        for (const txn of transactions) {
            const date = txn.punchTime.split('T')[0];
            const key = `${txn.empCode}|${date}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(txn);
        }

        return Object.entries(groups).map(([key, txns]) => {
            const [empCode, date] = key.split('|');
            const employeeId = employeeMap[empCode] || empCode;

            const inTxns = txns.filter(t => t.punchType === 'IN').sort((a, b) => a.punchTime.localeCompare(b.punchTime));
            const outTxns = txns.filter(t => t.punchType === 'OUT').sort((a, b) => b.punchTime.localeCompare(a.punchTime));

            const punchIn = inTxns.length > 0 ? inTxns[0].punchTime.split('T')[1]?.substring(0, 5) || null : null;
            const punchOut = outTxns.length > 0 ? outTxns[0].punchTime.split('T')[1]?.substring(0, 5) || null : null;

            return {
                employeeId,
                date,
                punchIn,
                punchOut,
                source: 'BIOMETRIC' as const,
                notes: `Synced from device (${txns.length} punch${txns.length > 1 ? 'es' : ''})`,
            };
        });
    },

    /**
     * Full sync: fetch from device → process → import
     */
    async syncAttendance(
        config: ZKTecoConfig,
        employeeMap: Record<string, string>,
        importFn: (records: { employeeId: string; date: string; punchIn: string | null; punchOut: string | null; source: 'BIOMETRIC'; notes: string }[]) => number,
        options?: { startDate?: string; endDate?: string }
    ): Promise<ZKTecoSyncResult> {
        const syncedAt = new Date().toISOString();
        const errors: string[] = [];

        try {
            const transactions = await this.fetchTransactions(config, {
                startDate: options?.startDate,
                endDate: options?.endDate,
                employeeCodes: Object.keys(employeeMap),
            });

            const processed = this.processTransactions(transactions, employeeMap);
            const imported = importFn(processed);

            return {
                success: true,
                transactionsFound: transactions.length,
                newRecordsImported: imported,
                duplicatesSkipped: processed.length - imported,
                errors,
                syncedAt,
            };
        } catch (error) {
            return {
                success: false,
                transactionsFound: 0,
                newRecordsImported: 0,
                duplicatesSkipped: 0,
                errors: [error instanceof Error ? error.message : 'Unknown sync error'],
                syncedAt,
            };
        }
    },

    /**
     * Get device info (simulated or real)
     */
    async getDeviceStatus(config: ZKTecoConfig): Promise<ZKTecoDeviceStatus> {
        const result = await this.testConnection(config);
        if (result.device) return result.device;

        return {
            serialNumber: config.deviceSn,
            name: 'SpeedFace-V5L',
            status: 'OFFLINE',
            lastActivity: '',
            firmwareVersion: 'Unknown',
            ipAddress: config.host,
            enrolledUsers: 0,
        };
    },
};

function mapVerifyMode(verifyType: number): 'FACE' | 'FINGERPRINT' | 'CARD' | 'PASSWORD' {
    switch (verifyType) {
        case 1: return 'FINGERPRINT';
        case 4: return 'CARD';
        case 6: return 'PASSWORD';
        default: return 'FACE';
    }
}
