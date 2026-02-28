// ─────────────────────────────────────────────────────────────
// HR Store — Employee data model & in-memory CRUD
// ─────────────────────────────────────────────────────────────

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
export type Gender = 'MALE' | 'FEMALE';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

export interface IncentiveSlab {
    label: string;        // e.g. "Slab 1", "Bronze", "Target A"
    targetAmount: number; // target to achieve (AED)
    percentage: number;   // incentive % on achieving this slab
}

export const DEPARTMENTS = ['Clinical', 'Administration', 'Operation'] as const;

// ── Workplace / Branch Constants ──
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

export interface Employee {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsappNumber?: string;
    nationality: string;
    dateOfBirth: string; // ISO date
    gender: Gender;
    maritalStatus?: MaritalStatus;
    employeeNumber?: string;
    religion?: string;
    ibanNumber?: string;

    // Employment
    designation: string;
    department: string;
    clinicId: string;
    joiningDate: string; // ISO date
    contractEndDate?: string;
    employmentType: EmploymentType;
    status: EmployeeStatus;
    weeklyOffDay?: string;
    noticePeriod?: string;
    probationPeriod?: string;
    penaltyTrainingExpenses?: number;
    resignationBanDuration?: string;
    penaltyBanDetails?: string;

    // Salary (AED)
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    workAllowance: number;
    trainingAllowance: number;
    otherAllowances: number;

    // Incentive Criteria
    incentiveBasis?: 'Income' | 'Profit'; // based on income or profit
    incentivePayoutTiming?: 'Current Month' | 'Following Month'; // when incentive is paid
    incentiveSlabs?: IncentiveSlab[]; // income/profit-based slabs
    packageSalesIncentiveSlabs?: IncentiveSlab[]; // package sales slabs (per employee)
    referralIncentiveSlabs?: IncentiveSlab[]; // referral incentive slabs (per employee)
    reviewThresholdPercent?: number; // min client review % required (e.g. 10 or 15)
    reviewPenaltyMonths?: number;   // consecutive months of not meeting review → incentives blocked (2-6)
    reviewPenaltyTypes?: string[];  // which incentive types get blocked on penalty

    // Leave
    annualLeaveEntitlement: number; // days per year, default 30
    leavesTaken: number;
    sickLeavesTaken: number;

    // Place of Work
    workplaceId: string; // matches WORKPLACES[].id
    workplaceName?: string; // display label

    // Visa / Emirates ID / Passport
    visaStatus: string;
    visaExpiryDate?: string;
    visaNumber?: string;
    visaType?: string; // Employment, Resident, Tourist, War Visa
    visaIssuingBranch?: string;
    workPermitNumber?: string; // was laborCardNumber
    workPermitExpiry?: string;
    workPermitStatus?: string;
    workPermitIssueDate?: string;
    lcPersonalNumber?: string;
    lcDesignation?: string;
    laborCardNumber?: string; // kept for backward compat
    laborCardExpiry?: string;
    laborCardStatus?: string;
    laborCardIssueDate?: string;
    emiratesId?: string;
    emiratesIdExpiry?: string;
    passportNumber?: string;
    passportExpiry?: string;

    // Medical Insurance
    medicalInsuranceProvider?: string;
    medicalInsurancePolicyNumber?: string;
    medicalInsuranceExpiry?: string;
    medicalInsuranceCategory?: string;

    // DHA & BLS License (Clinical staff)
    dhaLicenseNumber?: string;
    dhaLicenseExpiry?: string;
    blsCertificateNumber?: string;
    blsCertificateExpiry?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;
}

// ── Seed data ──
const initialEmployees: Employee[] = [
    {
        id: 'emp-001',
        employeeCode: 'FMC-001',
        firstName: 'Ahmed',
        lastName: 'Al Mansouri',
        email: 'ahmed@dubaifmc.com',
        phone: '+971501234567',
        whatsappNumber: '+971501234567',
        nationality: 'UAE',
        dateOfBirth: '1988-05-15',
        gender: 'MALE',
        maritalStatus: 'MARRIED',
        employeeNumber: 'EMP-2022-001',
        religion: 'Islam',
        ibanNumber: 'AE070331234567890123456',
        designation: 'General Practitioner',
        department: 'Clinical',
        clinicId: 'clinic-1',
        workplaceId: 'clinic-1',
        workplaceName: 'Al Muraqabat Branch',
        joiningDate: '2022-01-10',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        weeklyOffDay: 'Friday',
        noticePeriod: '1 Month',
        probationPeriod: '6 Months',
        basicSalary: 25000,
        housingAllowance: 5000,
        transportAllowance: 2000,
        workAllowance: 1500,
        trainingAllowance: 500,
        otherAllowances: 1000,
        incentiveBasis: 'Income',
        incentivePayoutTiming: 'Following Month',
        incentiveSlabs: [
            { label: 'Slab 1', targetAmount: 50000, percentage: 5 },
            { label: 'Slab 2', targetAmount: 100000, percentage: 8 },
            { label: 'Slab 3', targetAmount: 200000, percentage: 12 },
        ],
        packageSalesIncentiveSlabs: [
            { label: 'Bronze', targetAmount: 10000, percentage: 3 },
            { label: 'Silver', targetAmount: 25000, percentage: 5 },
            { label: 'Gold', targetAmount: 50000, percentage: 8 },
        ],
        referralIncentiveSlabs: [
            { label: '5+ Referrals', targetAmount: 5, percentage: 2 },
            { label: '10+ Referrals', targetAmount: 10, percentage: 4 },
        ],
        reviewThresholdPercent: 15,
        reviewPenaltyMonths: 3,
        reviewPenaltyTypes: ['Package Sales', 'Referral'],
        annualLeaveEntitlement: 30,
        leavesTaken: 5,
        sickLeavesTaken: 2,
        visaStatus: 'Valid',
        visaExpiryDate: '2026-06-15',
        visaNumber: 'V-2022-001',
        visaType: 'Employment',
        visaIssuingBranch: 'Al Muraqabat Branch',
        workPermitNumber: 'WP-2022-0451',
        workPermitExpiry: '2026-06-15',
        workPermitStatus: 'Card Issued',
        workPermitIssueDate: '2022-02-15',
        lcPersonalNumber: 'LCP-001-2022',
        lcDesignation: 'General Practitioner',
        laborCardNumber: 'LC-2022-0451',
        laborCardExpiry: '2026-06-15',
        laborCardStatus: 'Card Issued',
        laborCardIssueDate: '2022-02-15',
        emiratesId: '784-1988-1234567-1',
        emiratesIdExpiry: '2026-06-15',
        passportNumber: 'P1234567',
        passportExpiry: '2028-05-15',
        medicalInsuranceProvider: 'Daman',
        medicalInsurancePolicyNumber: 'DM-2022-78901',
        medicalInsuranceExpiry: '2026-12-31',
        medicalInsuranceCategory: 'Enhanced',
        dhaLicenseNumber: 'DHA-GP-2022-001',
        dhaLicenseExpiry: '2026-06-15',
        blsCertificateNumber: 'BLS-2024-001',
        blsCertificateExpiry: '2026-06-15',
        createdAt: '2022-01-10T00:00:00Z',
        updatedAt: '2024-01-10T00:00:00Z',
    },
    {
        id: 'emp-002',
        employeeCode: 'FMC-002',
        firstName: 'Fatima',
        lastName: 'Hassan',
        email: 'fatima@dubaifmc.com',
        phone: '+971509876543',
        whatsappNumber: '+971509876543',
        nationality: 'Egypt',
        dateOfBirth: '1992-09-22',
        gender: 'FEMALE',
        maritalStatus: 'SINGLE',
        employeeNumber: 'EMP-2023-002',
        religion: 'Islam',
        ibanNumber: 'AE120440987654321098765',
        designation: 'Nurse',
        department: 'Clinical',
        clinicId: 'clinic-1',
        workplaceId: 'clinic-2',
        workplaceName: 'Al Qiyadah Branch',
        joiningDate: '2023-03-01',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        weeklyOffDay: 'Friday',
        noticePeriod: '1 Month',
        probationPeriod: '3 Months',
        basicSalary: 8000,
        housingAllowance: 2500,
        transportAllowance: 1000,
        workAllowance: 800,
        trainingAllowance: 300,
        otherAllowances: 500,
        annualLeaveEntitlement: 30,
        leavesTaken: 10,
        sickLeavesTaken: 1,
        visaStatus: 'Valid',
        visaExpiryDate: '2026-03-20',
        visaNumber: 'V-2023-015',
        visaType: 'Employment',
        visaIssuingBranch: 'Al Qiyadah Branch',
        laborCardStatus: 'Card Issued',
        laborCardIssueDate: '2023-04-10',
        emiratesId: '784-1992-7654321-2',
        emiratesIdExpiry: '2026-03-20',
        passportNumber: 'E9876543',
        passportExpiry: '2027-09-22',
        medicalInsuranceProvider: 'Daman',
        medicalInsurancePolicyNumber: 'DM-2023-45678',
        medicalInsuranceExpiry: '2026-12-31',
        medicalInsuranceCategory: 'Basic',
        dhaLicenseNumber: 'DHA-NUR-2023-015',
        dhaLicenseExpiry: '2026-03-20',
        blsCertificateNumber: 'BLS-2024-015',
        blsCertificateExpiry: '2026-03-20',
        createdAt: '2023-03-01T00:00:00Z',
        updatedAt: '2024-06-15T00:00:00Z',
    },
    {
        id: 'emp-003',
        employeeCode: 'FMC-003',
        firstName: 'Ravi',
        lastName: 'Kumar',
        email: 'ravi@dubaifmc.com',
        phone: '+971507654321',
        whatsappNumber: '+971507654321',
        nationality: 'India',
        dateOfBirth: '1985-12-01',
        gender: 'MALE',
        maritalStatus: 'MARRIED',
        employeeNumber: 'EMP-2020-003',
        religion: 'Hinduism',
        ibanNumber: 'AE250260123456789012345',
        designation: 'Dermatologist',
        department: 'Clinical',
        clinicId: 'clinic-2',
        workplaceId: 'clinic-3',
        workplaceName: 'Silicon Oasis Branch',
        joiningDate: '2020-06-15',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        weeklyOffDay: 'Saturday',
        noticePeriod: '2 Months',
        probationPeriod: '6 Months',
        basicSalary: 30000,
        housingAllowance: 7000,
        transportAllowance: 2500,
        workAllowance: 2000,
        trainingAllowance: 1000,
        otherAllowances: 1500,
        annualLeaveEntitlement: 30,
        leavesTaken: 15,
        sickLeavesTaken: 3,
        visaStatus: 'Valid',
        visaExpiryDate: '2026-04-10',
        visaNumber: 'V-2020-088',
        visaType: 'Employment',
        visaIssuingBranch: 'Outside',
        laborCardNumber: 'LC-2020-0312',
        laborCardExpiry: '2026-04-10',
        laborCardStatus: 'Card Issued',
        laborCardIssueDate: '2020-08-01',
        emiratesId: '784-1985-9876543-3',
        emiratesIdExpiry: '2026-04-10',
        passportNumber: 'J5678901',
        passportExpiry: '2029-12-01',
        medicalInsuranceProvider: 'AXA',
        medicalInsurancePolicyNumber: 'AXA-2020-33456',
        medicalInsuranceExpiry: '2026-12-31',
        medicalInsuranceCategory: 'Enhanced',
        dhaLicenseNumber: 'DHA-DERM-2020-088',
        dhaLicenseExpiry: '2026-04-10',
        blsCertificateNumber: 'BLS-2024-088',
        blsCertificateExpiry: '2026-04-10',
        createdAt: '2020-06-15T00:00:00Z',
        updatedAt: '2024-03-20T00:00:00Z',
    },
];

// ── In-memory store ──
let employees: Employee[] = JSON.parse(JSON.stringify(initialEmployees));

export const HRStore = {
    getAll: (filters?: { search?: string; status?: EmployeeStatus; department?: string; clinicId?: string }): Employee[] => {
        let result = [...employees];

        if (filters?.status) {
            result = result.filter(e => e.status === filters.status);
        }
        if (filters?.department) {
            result = result.filter(e => e.department.toLowerCase().includes(filters.department!.toLowerCase()));
        }
        if (filters?.clinicId) {
            result = result.filter(e => e.clinicId === filters.clinicId);
        }
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(e =>
                e.firstName.toLowerCase().includes(q) ||
                e.lastName.toLowerCase().includes(q) ||
                e.employeeCode.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                e.designation.toLowerCase().includes(q)
            );
        }

        return result;
    },

    getById: (id: string): Employee | undefined => {
        return employees.find(e => e.id === id);
    },

    add: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Employee => {
        const now = new Date().toISOString();
        const newEmployee: Employee = {
            ...data,
            id: `emp-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
        };
        employees.push(newEmployee);
        return newEmployee;
    },

    update: (id: string, updates: Partial<Omit<Employee, 'id' | 'createdAt'>>): Employee | null => {
        const index = employees.findIndex(e => e.id === id);
        if (index === -1) return null;

        employees[index] = {
            ...employees[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        return employees[index];
    },

    delete: (id: string): boolean => {
        const len = employees.length;
        employees = employees.filter(e => e.id !== id);
        return employees.length < len;
    },

    getNextCode: (): string => {
        const maxNum = employees.reduce((max, e) => {
            const match = e.employeeCode.match(/FMC-(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `FMC-${String(maxNum + 1).padStart(3, '0')}`;
    },

    getStats: () => {
        const total = employees.length;
        const active = employees.filter(e => e.status === 'ACTIVE').length;
        const onLeave = employees.filter(e => e.status === 'ON_LEAVE').length;
        const terminated = employees.filter(e => e.status === 'TERMINATED').length;
        const resigned = employees.filter(e => e.status === 'RESIGNED').length;
        return { total, active, onLeave, terminated, resigned };
    },
};
