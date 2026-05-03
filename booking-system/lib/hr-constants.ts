export const DEPARTMENTS = ['Clinical', 'Administration', 'Operation'] as const;

export const WORKPLACES = [
    { id: 'clinic-1', name: 'Al Muraqabat Branch' },
    { id: 'clinic-2', name: 'Al Qiyadah Branch' },
    { id: 'clinic-3', name: 'Silicon Oasis Branch' },
    { id: 'head-office', name: 'Head Office' },
] as const;

export const VISA_ISSUING_BRANCHES = [
    'Al Muraqabat Branch',
    'Al Qiyadah Branch',
    'Silicon Oasis Branch',
    'Head Office',
    'Outside',
] as const;

export const LABOR_CARD_STATUSES = [
    'Not Started',
    'Application Submitted',
    'Under Processing',
    'Medical Test Pending',
    'Medical Test Done',
    'Awaiting Approval',
    'Approved',
    'Card Issued',
    'Renewal Pending',
    'Expired',
    'Cancelled',
] as const;

export type LetterType = 'SALARY_CERTIFICATE' | 'EMPLOYMENT_CERTIFICATE' | 'EXPERIENCE_CERTIFICATE';

export const LETTER_TYPE_LABELS: Record<string, string> = {
    SALARY_CERTIFICATE: 'Salary Certificate',
    EMPLOYMENT_CERTIFICATE: 'Employment Certificate',
    EXPERIENCE_CERTIFICATE: 'Experience Certificate',
};

export const LETTER_REF_PREFIXES: Record<string, string> = {
    SALARY_CERTIFICATE: 'SC',
    EMPLOYMENT_CERTIFICATE: 'EC',
    EXPERIENCE_CERTIFICATE: 'EXP',
};

export type DocumentCategory =
    | 'RECRUITMENT'
    | 'LEGAL'
    | 'PROFESSIONAL'
    | 'TRAINING'
    | 'IN_SERVICE'
    | 'COMPANY_CERTIFICATES'
    | 'HIRING_PROCESS'
    | 'END_OF_SERVICE';

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
            'Professional Photo',
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

export const DOCUMENT_TYPES = DOCUMENT_CATEGORIES.flatMap(c => c.docTypes);
export type DocumentType = string;

export function getCategoryForDocType(docType: string): DocumentCategoryInfo | undefined {
    return DOCUMENT_CATEGORIES.find(c => c.docTypes.includes(docType));
}

export const EXPIRABLE_DOCUMENT_TYPES: string[] = DOCUMENT_CATEGORIES
    .filter(c => c.hasExpiry)
    .flatMap(c => c.docTypes);

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
