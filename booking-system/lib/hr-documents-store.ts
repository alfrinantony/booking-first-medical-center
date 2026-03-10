// ─────────────────────────────────────────────────────────────
// HR Documents Store — Categorised document metadata & expiry tracking
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export type DocumentCategory =
    | 'RECRUITMENT'
    | 'LEGAL'
    | 'PROFESSIONAL'
    | 'TRAINING'
    | 'IN_SERVICE'
    | 'COMPANY_CERTIFICATES'
    | 'HIRING_PROCESS'
    | 'END_OF_SERVICE';

// ── Category definitions with labels, icons & colors ──

export interface DocumentCategoryInfo {
    key: DocumentCategory;
    label: string;
    icon: string;      // emoji
    color: string;      // tailwind color name
    docTypes: string[];
    hasExpiry: boolean;       // documents in this category typically have expiry
    allowMultiple: boolean;  // can upload multiple of the same type
    hasIssueDate: boolean;   // requires issue date
    hasComment: boolean;     // has a comment/notes field
}

export const DOCUMENT_CATEGORIES: DocumentCategoryInfo[] = [
    {
        key: 'RECRUITMENT',
        label: 'Recruitment',
        icon: '📋',
        color: 'blue',
        hasExpiry: false,
        allowMultiple: false,
        hasIssueDate: false,
        hasComment: false,
        docTypes: [
            'CV',
            'Photo',
            'Job Application Form',
            'Medical Questionnaire Form',
            'Staff Data Form',
            'Interview Feedback Report',
            'Candidate Declaration Form',
            'Confidentiality Agreement',
            'Professional Code of Conduct',
            'Signed Offer Letter',
            'Media Release Consent Form',
        ],
    },
    {
        key: 'LEGAL',
        label: 'Legal Documents',
        icon: '⚖️',
        color: 'red',
        hasExpiry: true,
        allowMultiple: false,
        hasIssueDate: false,
        hasComment: false,
        docTypes: [
            'Passport',
            'Home Country ID Card',
            'Contract',
            'Residence Visa',
            'UAE ID',
            'Labour Card',
            'Medical Insurance',
            'DHA License',
            'BLS',
            'Bank Account Details',
        ],
    },
    {
        key: 'PROFESSIONAL',
        label: 'Professional Documents',
        icon: '🎓',
        color: 'purple',
        hasExpiry: false,
        allowMultiple: false,
        hasIssueDate: false,
        hasComment: false,
        docTypes: [
            'Educational Certificates',
            'DHA Eligibility',
            'Job Description',
            'Log Book',
            'Privilege Certificate',
            'HepB Vaccination',
        ],
    },
    {
        key: 'TRAINING',
        label: 'Training Certificates',
        icon: '📜',
        color: 'amber',
        hasExpiry: true,
        allowMultiple: true,
        hasIssueDate: false,
        hasComment: true,
        docTypes: [
            'Fire & Safety',
            'Laser Hair Removal Training',
            'Electrolysis Training',
            'Infection Control Training',
            'Aesthetic Training',
            'Equipment Training',
            'Software Training',
            'NABIDH Training Certificate',
        ],
    },
    {
        key: 'IN_SERVICE',
        label: 'In-Service Forms',
        icon: '📝',
        color: 'green',
        hasExpiry: false,
        allowMultiple: true,
        hasIssueDate: true,
        hasComment: true,
        docTypes: [
            'Sick Leave',
            'Explanation Letter',
            'Warning Letter',
            'Suspension Letter',
            'Appreciation Letter',
            'Employee of the Month Certificate',
            'Promotion Letter',
            'Salary Increment Letter',
        ],
    },
    {
        key: 'COMPANY_CERTIFICATES',
        label: 'Certificates Issued from Company',
        icon: '🏢',
        color: 'indigo',
        hasExpiry: false,
        allowMultiple: true,
        hasIssueDate: true,
        hasComment: true,
        docTypes: [
            'Salary Certificate',
            'Employment Certificate',
            'Experience Certificate',
        ],
    },
    {
        key: 'HIRING_PROCESS',
        label: 'Hiring Process Documents',
        icon: '🗂️',
        color: 'teal',
        hasExpiry: false,
        allowMultiple: false,
        hasIssueDate: false,
        hasComment: false,
        docTypes: [
            'MOHRE Offer Letter',
            'MOHRE Insurance',
            'Employment Visa',
            'Visit Visa',
            'Previous Company Visa Cancellation',
            'Old UAE ID',
            'Stamped Entry Visa',
            'Change Status',
            'Flight Ticket',
            'Medical Application Form',
            'Medical HepB Forms',
            'Medical Fitness Certificate',
            'UAE ID Form',
            'NOC From Sponsor',
            "Sponsor's ID Proof",
            'Driving License',
            'Performance Assessment',
            'Uniform Receiving Form',
            'Stamp Receiving Form',
            'Date of Joining Form',
        ],
    },
    {
        key: 'END_OF_SERVICE',
        label: 'End of Service',
        icon: '🔚',
        color: 'gray',
        hasExpiry: false,
        allowMultiple: false,
        hasIssueDate: false,
        hasComment: false,
        docTypes: [
            'Employee Clearance Form',
            'End of Service Settlement',
            'MOHRE Cancellation Form',
            'MOHRE Cancellation Document',
            'Visa Cancellation Document',
            'COE',
        ],
    },
];

// Flat list of all document types (for backward compat)
export const DOCUMENT_TYPES = DOCUMENT_CATEGORIES.flatMap(c => c.docTypes);
export type DocumentType = string;

// Helper: find category for a given doc type
export function getCategoryForDocType(docType: string): DocumentCategoryInfo | undefined {
    return DOCUMENT_CATEGORIES.find(c => c.docTypes.includes(docType));
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    category: DocumentCategory;
    documentType: string;
    fileName: string;
    blobUrl: string; // Azure Blob URL or local path
    fileSize: number; // bytes
    mimeType: string;
    uploadedAt: string; // ISO date
    expiryDate?: string; // ISO date — null if not applicable
    issueDate?: string;  // ISO date — for in-service / company certs
    notes?: string;
}

// Documents that typically have expiry dates
export const EXPIRABLE_DOCUMENT_TYPES: string[] = DOCUMENT_CATEGORIES
    .filter(c => c.hasExpiry)
    .flatMap(c => c.docTypes);

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
let docLoaded = false;

async function ensureDocLoaded() {
    if (!docLoaded) {
        documents = await loadFromBlob<EmployeeDocument[]>('hr-documents', initialDocuments);
        docLoaded = true;
    }
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
