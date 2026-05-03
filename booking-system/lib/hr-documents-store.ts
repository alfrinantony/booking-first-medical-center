// ─────────────────────────────────────────────────────────────
// HR Documents Store — Categorised document metadata & expiry tracking
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export * from './hr-constants';

// ── Seed data ──
const initialDocuments: EmployeeDocument[] = [
    {
        id: 'doc-001',
        employeeId: 'emp-001',
        category: 'LEGAL',
        documentType: 'Passport',
        fileName: 'ahmed_passport.pdf',
        blobUrl: '/mock/ahmed_passport.pdf',
        fileSize: 524288,
        mimeType: 'application/pdf',
        uploadedAt: '2024-01-15T10:00:00Z',
        expiryDate: '2028-05-15',
    },
    {
        id: 'doc-002',
        employeeId: 'emp-001',
        category: 'LEGAL',
        documentType: 'UAE ID',
        fileName: 'ahmed_eid_front.jpg',
        blobUrl: '/mock/ahmed_eid_front.jpg',
        fileSize: 256000,
        mimeType: 'image/jpeg',
        uploadedAt: '2024-01-15T10:05:00Z',
        expiryDate: '2026-06-15',
    },
    {
        id: 'doc-003',
        employeeId: 'emp-001',
        category: 'LEGAL',
        documentType: 'DHA License',
        fileName: 'ahmed_dha_license.pdf',
        blobUrl: '/mock/ahmed_dha_license.pdf',
        fileSize: 312000,
        mimeType: 'application/pdf',
        uploadedAt: '2024-02-01T09:00:00Z',
        expiryDate: '2026-04-01',
    },
    {
        id: 'doc-004',
        employeeId: 'emp-002',
        category: 'LEGAL',
        documentType: 'Residence Visa',
        fileName: 'fatima_visa.pdf',
        blobUrl: '/mock/fatima_visa.pdf',
        fileSize: 410000,
        mimeType: 'application/pdf',
        uploadedAt: '2023-03-15T08:00:00Z',
        expiryDate: '2026-03-20',
    },
    {
        id: 'doc-005',
        employeeId: 'emp-002',
        category: 'LEGAL',
        documentType: 'BLS',
        fileName: 'fatima_bls.pdf',
        blobUrl: '/mock/fatima_bls.pdf',
        fileSize: 198000,
        mimeType: 'application/pdf',
        uploadedAt: '2024-06-01T11:00:00Z',
        expiryDate: '2026-06-01',
    },
    {
        id: 'doc-006',
        employeeId: 'emp-003',
        category: 'LEGAL',
        documentType: 'Contract',
        fileName: 'ravi_contract.pdf',
        blobUrl: '/mock/ravi_contract.pdf',
        fileSize: 650000,
        mimeType: 'application/pdf',
        uploadedAt: '2020-06-15T09:00:00Z',
    },
];

// ── In-memory store ──
let documents: EmployeeDocument[] = JSON.parse(JSON.stringify(initialDocuments));
async function ensureDocLoaded() {
    
        documents = await loadFromBlob<EmployeeDocument[]>('hr-documents', initialDocuments);
        
}

async function saveDoc() {
    await saveToBlob('hr-documents', documents);
}

export const HRDocumentsStore = {
    getByEmployee: async (employeeId: string): Promise<EmployeeDocument[]> => {
        await ensureDocLoaded();
        return documents.filter(d => d.employeeId === employeeId);
    },

    getById: async (id: string): Promise<EmployeeDocument | undefined> => {
        await ensureDocLoaded();
        return documents.find(d => d.id === id);
    },

    add: async (data: Omit<EmployeeDocument, 'id'>): Promise<EmployeeDocument> => {
        await ensureDocLoaded();
        const doc: EmployeeDocument = {
            ...data,
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        documents.push(doc);
        await saveDoc();
        return doc;
    },

    delete: async (id: string): Promise<boolean> => {
        await ensureDocLoaded();
        const len = documents.length;
        documents = documents.filter(d => d.id !== id);
        if (documents.length < len) { await saveDoc(); return true; }
        return false;
    },

    /** Documents expiring within `withinDays` from now */
    getExpiringSoon: async (withinDays: number = 30): Promise<(EmployeeDocument & { daysRemaining: number })[]> => {
        await ensureDocLoaded();
        const now = new Date();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + withinDays);

        return documents
            .filter(d => d.expiryDate)
            .map(d => {
                const expiry = new Date(d.expiryDate!);
                const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return { ...d, daysRemaining };
            })
            .filter(d => d.daysRemaining >= 0 && d.daysRemaining <= withinDays)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    },

    /** Documents already expired */
    getExpired: async (): Promise<(EmployeeDocument & { daysOverdue: number })[]> => {
        await ensureDocLoaded();
        const now = new Date();
        return documents
            .filter(d => d.expiryDate)
            .map(d => {
                const expiry = new Date(d.expiryDate!);
                const daysOverdue = Math.ceil((now.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));
                return { ...d, daysOverdue };
            })
            .filter(d => d.daysOverdue > 0)
            .sort((a, b) => b.daysOverdue - a.daysOverdue);
    },

    /** All documents (for reports) */
    getAll: async (): Promise<EmployeeDocument[]> => {
        await ensureDocLoaded();
        return [...documents];
    },
};
