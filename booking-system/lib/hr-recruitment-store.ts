// ─────────────────────────────────────────────────────────────
// HR Recruitment Store — Job Openings & Candidate Pipeline
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export const RECRUITMENT_STAGES = [
    'Application Received',
    'Screening',
    'Interview Scheduled',
    'Interview Done',
    'Offer Sent',
    'Offer Accepted',
    'Onboarding',
    'Hired',
    'Rejected',
    'Withdrawn',
] as const;

export type RecruitmentStage = typeof RECRUITMENT_STAGES[number];

export const ACTIVE_STAGES: RecruitmentStage[] = [
    'Application Received', 'Screening', 'Interview Scheduled',
    'Interview Done', 'Offer Sent', 'Offer Accepted', 'Onboarding',
];

export const CANDIDATE_SOURCES = [
    'Job Portal', 'Referral', 'Walk-In', 'LinkedIn', 'Agency', 'Website', 'Other',
] as const;

export type CandidateSource = typeof CANDIDATE_SOURCES[number];

export type OpeningStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED';

export interface JobOpening {
    id: string;
    title: string;
    department: string;
    workplaceId: string;
    workplaceName: string;
    employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
    description: string;
    requirements: string;
    salaryMin?: number;
    salaryMax?: number;
    status: OpeningStatus;
    openDate: string;
    closeDate?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Candidate {
    id: string;
    jobOpeningId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    currentPosition?: string;
    experience: number; // years
    stage: RecruitmentStage;
    source: CandidateSource;
    resumeFileName?: string;
    resumeUrl?: string;
    photoFileName?: string;
    photoUrl?: string;
    cvFileName?: string;
    cvUrl?: string;
    interviewDate?: string;
    interviewNotes?: string;
    interviewRating?: number; // 1-5
    offerSalary?: number;
    offerDate?: string;
    expectedJoiningDate?: string;
    notes?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
}

// ── Job Description Templates for common roles ──
export const JOB_DESCRIPTION_TEMPLATES: Record<string, { description: string; requirements: string }> = {
    'Registered Nurse': {
        description: 'Provide professional nursing care to patients in a clinical setting. Assess patient needs, develop care plans, administer medications, monitor vital signs, and coordinate with physicians and other healthcare professionals to ensure optimal patient outcomes.',
        requirements: 'Valid DHA/MOH nursing license, Bachelor of Science in Nursing (BSN), minimum 2 years clinical experience, BLS/ACLS certification, strong communication skills, fluent in English',
    },
    'Assistant Nurse': {
        description: 'Assist registered nurses and physicians with patient care activities including taking vitals, preparing treatment rooms, sterilising equipment, escorting patients, and maintaining accurate patient records under supervision.',
        requirements: 'Nursing diploma or equivalent, valid DHA eligibility letter, 1+ year experience in a clinical environment, BLS certification, basic computer skills',
    },
    'Laser Technician': {
        description: 'Perform laser hair removal and skin treatments using advanced laser and IPL platforms. Conduct skin assessments, customise treatment parameters, ensure patient safety, and maintain equipment. Educate patients on pre- and post-treatment care.',
        requirements: 'DHA license as Laser Technician, minimum 3 years laser experience, certified in multiple laser platforms (Diode, Alexandrite, Nd:YAG), strong knowledge of skin types and contraindications, BLS certification',
    },
    'Beauty Therapist': {
        description: 'Deliver a range of beauty and aesthetic treatments including facials, chemical peels, body treatments, and non-invasive skin rejuvenation procedures. Provide personalised skincare consultations and recommend appropriate treatment plans.',
        requirements: 'CIBTAC/CIDESCO or equivalent qualification, DHA eligibility, 2+ years experience in a medical aesthetic or spa setting, knowledge of professional skincare brands, excellent client communication skills',
    },
    'Aesthetic General Practitioner': {
        description: 'Provide aesthetic medical consultations and perform non-surgical cosmetic procedures including Botox, dermal fillers, PRP therapy, mesotherapy, and thread lifts. Assess patients, develop treatment plans, and ensure clinical safety and patient satisfaction.',
        requirements: 'MBBS/MD with DHA license, specialisation or fellowship in aesthetic medicine preferred, 3+ years experience in aesthetic procedures, proficiency in facial anatomy and injection techniques, BLS/ACLS certification',
    },
    'Dermatologist': {
        description: 'Diagnose and treat skin conditions including acne, eczema, psoriasis, hair loss, and pigmentation disorders. Perform dermatological procedures such as biopsies, cryotherapy, and laser treatments. Provide cosmetic dermatology services.',
        requirements: 'MD/MBBS with specialisation in Dermatology, valid DHA specialist license, 5+ years dermatology experience, proficiency in dermatological laser procedures, published research preferred, BLS certification',
    },
    'Receptionist': {
        description: 'Manage front desk operations including patient registration, appointment scheduling, phone/email correspondence, insurance verification, and payment collection. Provide excellent customer service and ensure smooth patient flow throughout the clinic.',
        requirements: 'Diploma or equivalent, fluent in English and Arabic, 1+ year experience in medical or hospitality reception, proficient in scheduling software and MS Office, excellent interpersonal and organisational skills',
    },
    'Administrator': {
        description: 'Oversee daily administrative operations of the clinic including staff coordination, inventory management, compliance documentation, vendor liaison, and reporting. Support the management team with operational planning and process improvement.',
        requirements: 'Bachelor\'s degree in Business Administration or related field, 3+ years administrative experience in healthcare, strong organisational and multitasking skills, proficient in MS Office and clinic management software, knowledge of DHA regulations preferred',
    },
    'Clinic Coordinator': {
        description: 'Coordinate daily clinic activities between departments, manage patient flow, schedule staff rosters, handle patient complaints and feedback, liaise with insurance companies, and ensure compliance with clinic protocols and DHA standards.',
        requirements: 'Bachelor\'s degree in Healthcare Management or related field, 2+ years experience in clinic coordination, strong leadership and communication skills, fluent in English and Arabic, knowledge of DHA standards and insurance processes',
    },
};

// ── Seed data ──
const initialOpenings: JobOpening[] = [
    {
        id: 'job-001',
        title: 'Dermatology Nurse',
        department: 'Dermatology',
        workplaceId: 'clinic-1',
        workplaceName: 'Al Muraqabat Branch',
        employmentType: 'FULL_TIME',
        description: 'Looking for an experienced dermatology nurse to assist with laser and skin treatments.',
        requirements: 'DHA/MOH License, 2+ years dermatology experience, BLS certification',
        salaryMin: 7000,
        salaryMax: 10000,
        status: 'OPEN',
        openDate: '2026-01-15',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
    },
    {
        id: 'job-002',
        title: 'Receptionist',
        department: 'Administration',
        workplaceId: 'clinic-2',
        workplaceName: 'Al Qiyadah Branch',
        employmentType: 'FULL_TIME',
        description: 'Front desk receptionist for patient scheduling and clinic coordination.',
        requirements: 'Fluent English & Arabic, customer service experience, basic computer skills',
        salaryMin: 4000,
        salaryMax: 6000,
        status: 'OPEN',
        openDate: '2026-02-01',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
    },
    {
        id: 'job-003',
        title: 'Laser Technician',
        department: 'Laser & Electrolysis Hair Removal',
        workplaceId: 'clinic-3',
        workplaceName: 'Silicon Oasis Branch',
        employmentType: 'FULL_TIME',
        description: 'Certified laser technician for hair removal and skin treatments.',
        requirements: 'DHA License, 3+ years laser experience, certified in multiple laser platforms',
        salaryMin: 8000,
        salaryMax: 12000,
        status: 'ON_HOLD',
        openDate: '2026-01-20',
        createdAt: '2026-01-20T00:00:00Z',
        updatedAt: '2026-02-10T00:00:00Z',
    },
];

const initialCandidates: Candidate[] = [
    {
        id: 'cand-001',
        jobOpeningId: 'job-001',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j@email.com',
        phone: '+971501112222',
        nationality: 'Philippines',
        currentPosition: 'Nurse – Skin Clinic',
        experience: 4,
        stage: 'Interview Scheduled',
        source: 'LinkedIn',
        interviewDate: '2026-03-05',
        notes: 'Strong candidate with laser-assist experience',
        createdAt: '2026-02-10T00:00:00Z',
        updatedAt: '2026-02-20T00:00:00Z',
    },
    {
        id: 'cand-002',
        jobOpeningId: 'job-001',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.g@email.com',
        phone: '+971502223333',
        nationality: 'India',
        currentPosition: 'Senior Nurse',
        experience: 6,
        stage: 'Screening',
        source: 'Agency',
        notes: 'DHA licensed, currently under notice period',
        createdAt: '2026-02-12T00:00:00Z',
        updatedAt: '2026-02-12T00:00:00Z',
    },
    {
        id: 'cand-003',
        jobOpeningId: 'job-002',
        firstName: 'Fatima',
        lastName: 'Ali',
        email: 'fatima.ali@email.com',
        phone: '+971503334444',
        nationality: 'UAE',
        currentPosition: 'Receptionist – Hotel',
        experience: 3,
        stage: 'Interview Done',
        source: 'Walk-In',
        interviewDate: '2026-02-20',
        interviewNotes: 'Excellent communication, bilingual, very presentable',
        interviewRating: 4,
        createdAt: '2026-02-05T00:00:00Z',
        updatedAt: '2026-02-21T00:00:00Z',
    },
    {
        id: 'cand-004',
        jobOpeningId: 'job-002',
        firstName: 'Omar',
        lastName: 'Hassan',
        email: 'omar.h@email.com',
        phone: '+971504445555',
        nationality: 'Egypt',
        currentPosition: 'Call Center Agent',
        experience: 2,
        stage: 'Application Received',
        source: 'Job Portal',
        createdAt: '2026-02-22T00:00:00Z',
        updatedAt: '2026-02-22T00:00:00Z',
    },
    {
        id: 'cand-005',
        jobOpeningId: 'job-001',
        firstName: 'Anna',
        lastName: 'Petrovna',
        email: 'anna.p@email.com',
        phone: '+971505556666',
        nationality: 'Russia',
        currentPosition: 'Aesthetic Nurse',
        experience: 5,
        stage: 'Offer Sent',
        source: 'Referral',
        interviewDate: '2026-02-15',
        interviewNotes: 'Excellent skills, great communication, DHA licensed',
        interviewRating: 5,
        offerSalary: 9500,
        offerDate: '2026-02-25',
        expectedJoiningDate: '2026-03-15',
        createdAt: '2026-02-08T00:00:00Z',
        updatedAt: '2026-02-25T00:00:00Z',
    },
];

// ── In-memory stores ──
let openings: JobOpening[] = JSON.parse(JSON.stringify(initialOpenings));
let candidates: Candidate[] = JSON.parse(JSON.stringify(initialCandidates));
let recLoaded = false;

interface RecBlobData { openings: JobOpening[]; candidates: Candidate[] }

async function ensureRecLoaded() {
    if (!recLoaded) {
        const data = await loadFromBlob<RecBlobData>('hr-recruitment', null as any);
        if (data) {
            openings = data.openings;
            candidates = data.candidates;
        }
        recLoaded = true;
    }
}

async function saveRec() {
    await saveToBlob<RecBlobData>('hr-recruitment', { openings, candidates });
}

export const RecruitmentStore = {
    // ─── Openings ───
    getAllOpenings: async (filters?: { status?: OpeningStatus; search?: string }): Promise<JobOpening[]> => {
        await ensureRecLoaded();
        let result = [...openings];
        if (filters?.status) {
            result = result.filter(o => o.status === filters.status);
        }
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(o =>
                o.title.toLowerCase().includes(q) ||
                o.department.toLowerCase().includes(q) ||
                o.workplaceName.toLowerCase().includes(q)
            );
        }
        return result.map(o => ({
            ...o,
            _candidateCount: candidates.filter(c => c.jobOpeningId === o.id).length,
        }));
    },

    getOpeningById: async (id: string): Promise<JobOpening | undefined> => {
        await ensureRecLoaded();
        return openings.find(o => o.id === id);
    },

    addOpening: async (data: Omit<JobOpening, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobOpening> => {
        await ensureRecLoaded();
        const now = new Date().toISOString();
        const opening: JobOpening = {
            ...data,
            id: `job-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
        };
        openings.push(opening);
        await saveRec();
        return opening;
    },

    updateOpening: async (id: string, updates: Partial<Omit<JobOpening, 'id' | 'createdAt'>>): Promise<JobOpening | null> => {
        await ensureRecLoaded();
        const idx = openings.findIndex(o => o.id === id);
        if (idx === -1) return null;
        openings[idx] = { ...openings[idx], ...updates, updatedAt: new Date().toISOString() };
        await saveRec();
        return openings[idx];
    },

    deleteOpening: async (id: string): Promise<boolean> => {
        await ensureRecLoaded();
        const len = openings.length;
        openings = openings.filter(o => o.id !== id);
        candidates = candidates.filter(c => c.jobOpeningId !== id); // cascade
        if (openings.length < len) { await saveRec(); return true; }
        return false;
    },

    // ─── Candidates ───
    getAllCandidates: async (filters?: { openingId?: string; stage?: RecruitmentStage; search?: string }): Promise<Candidate[]> => {
        await ensureRecLoaded();
        let result = [...candidates];
        if (filters?.openingId) {
            result = result.filter(c => c.jobOpeningId === filters.openingId);
        }
        if (filters?.stage) {
            result = result.filter(c => c.stage === filters.stage);
        }
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(c =>
                c.firstName.toLowerCase().includes(q) ||
                c.lastName.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q)
            );
        }
        return result;
    },

    getCandidateById: async (id: string): Promise<Candidate | undefined> => {
        await ensureRecLoaded();
        return candidates.find(c => c.id === id);
    },

    addCandidate: async (data: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Candidate> => {
        await ensureRecLoaded();
        const now = new Date().toISOString();
        const candidate: Candidate = {
            ...data,
            id: `cand-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
        };
        candidates.push(candidate);
        await saveRec();
        return candidate;
    },

    updateCandidate: async (id: string, updates: Partial<Omit<Candidate, 'id' | 'createdAt'>>): Promise<Candidate | null> => {
        await ensureRecLoaded();
        const idx = candidates.findIndex(c => c.id === id);
        if (idx === -1) return null;
        candidates[idx] = { ...candidates[idx], ...updates, updatedAt: new Date().toISOString() };
        await saveRec();
        return candidates[idx];
    },

    deleteCandidate: async (id: string): Promise<boolean> => {
        await ensureRecLoaded();
        const len = candidates.length;
        candidates = candidates.filter(c => c.id !== id);
        if (candidates.length < len) { await saveRec(); return true; }
        return false;
    },

    getStats: async () => {
        await ensureRecLoaded();
        const totalOpenings = openings.length;
        const openPositions = openings.filter(o => o.status === 'OPEN').length;
        const totalCandidates = candidates.length;
        const activeCandidates = candidates.filter(c =>
            !['Hired', 'Rejected', 'Withdrawn'].includes(c.stage)
        ).length;
        const hired = candidates.filter(c => c.stage === 'Hired').length;
        const inInterview = candidates.filter(c =>
            c.stage === 'Interview Scheduled' || c.stage === 'Interview Done'
        ).length;
        const offersPending = candidates.filter(c =>
            c.stage === 'Offer Sent'
        ).length;
        return { totalOpenings, openPositions, totalCandidates, activeCandidates, hired, inInterview, offersPending };
    },
};
