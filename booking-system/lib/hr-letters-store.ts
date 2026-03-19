// ─────────────────────────────────────────────────────────────
// HR Letters Store — Employee certificate/letter generation
// ─────────────────────────────────────────────────────────────

import { HRStore } from './hr-store';
import type { Employee } from './hr-store';
import { loadFromBlob, saveToBlob } from './blob-persistence';

export type LetterType = 'SALARY_CERTIFICATE' | 'EMPLOYMENT_CERTIFICATE' | 'EXPERIENCE_CERTIFICATE';
export type LetterStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
    SALARY_CERTIFICATE: 'Salary Certificate',
    EMPLOYMENT_CERTIFICATE: 'Employment Certificate',
    EXPERIENCE_CERTIFICATE: 'Experience Certificate',
};

const LETTER_REF_PREFIXES: Record<LetterType, string> = {
    SALARY_CERTIFICATE: 'SC',
    EMPLOYMENT_CERTIFICATE: 'EC',
    EXPERIENCE_CERTIFICATE: 'EXP',
};

export interface EmployeeLetter {
    id: string;
    referenceNumber: string;        // e.g. FMC/SC/2026/001
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    letterType: LetterType;
    status: LetterStatus;
    issuedDate: string;             // ISO date of issue
    generatedBy: string;            // HR user who created it
    approvedBy?: string;            // CEO who approved
    approvedDate?: string;          // when approved
    rejectedReason?: string;
    // Experience certificate extras
    endDate?: string;               // last working day (for experience cert)
    sickLeavesTaken?: number;
    disciplinaryActions?: string;   // summary (excl. suspension/warning)
    // Computed content
    content: string;                // rendered HTML letter
    createdAt: string;
    updatedAt: string;
}

// ── Counters for ref numbers (shared via globalThis) ──
const _global = globalThis as any;
if (!_global.__hrLettersCounters) _global.__hrLettersCounters = {};
const counters: Record<string, number> = _global.__hrLettersCounters;

function getNextRefNumber(type: LetterType): string {
    const year = new Date().getFullYear();
    const prefix = LETTER_REF_PREFIXES[type];
    const key = `${prefix}-${year}`;
    counters[key] = (counters[key] || 0) + 1;
    return `FMC/${prefix}/${year}/${String(counters[key]).padStart(3, '0')}`;
}

// ── Template rendering ──

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderSalaryCertificate(emp: Employee, issuedDate: string, refNum: string): string {
    const gross = emp.basicSalary + emp.housingAllowance + emp.transportAllowance
        + (emp.workAllowance || 0) + (emp.trainingAllowance || 0) + emp.otherAllowances;
    return `
<div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px 60px; color: #1a1a1a;">
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px double #1a365d; padding-bottom: 20px;">
        <h1 style="font-size: 28px; color: #1a365d; margin: 0; letter-spacing: 2px;">FIRST MEDICAL CENTER LLC</h1>
        <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Dubai, United Arab Emirates</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px;">
        <div><strong>Ref:</strong> ${refNum}</div>
        <div><strong>Date:</strong> ${formatDate(issuedDate)}</div>
    </div>

    <h2 style="text-align: center; font-size: 20px; text-decoration: underline; margin-bottom: 30px; color: #1a365d;">SALARY CERTIFICATE</h2>

    <div style="line-height: 1.8; font-size: 14px;">
        <p><strong>To Whom It May Concern,</strong></p>

        <p>This is to certify that <strong>${emp.firstName} ${emp.lastName}</strong>, holder of Passport No. <strong>${emp.passportNumber || '—'}</strong>,
        is employed with First Medical Center LLC as <strong>${emp.designation}</strong> in the <strong>${emp.department}</strong> department
        since <strong>${formatDate(emp.joiningDate)}</strong>.</p>

        <p>The monthly salary details are as follows:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Basic Salary</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.basicSalary.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Housing Allowance</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.housingAllowance.toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Transport Allowance</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.transportAllowance.toLocaleString()}</td>
                </tr>
                ${emp.workAllowance ? `<tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Work Allowance</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.workAllowance.toLocaleString()}</td>
                </tr>` : ''}
                ${emp.trainingAllowance ? `<tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Training Allowance</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.trainingAllowance.toLocaleString()}</td>
                </tr>` : ''}
                ${emp.otherAllowances ? `<tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Other Allowances</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold;">AED ${emp.otherAllowances.toLocaleString()}</td>
                </tr>` : ''}
                <tr style="border-top: 2px solid #1a365d; background: #f7fafc;">
                    <td style="padding: 10px 12px; font-weight: bold;">Total Monthly Salary</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #1a365d;">AED ${gross.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>

        <p>This certificate is issued upon the request of the employee for whatever purpose it may serve.</p>
    </div>

    <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px;">
        <div>
            <p style="margin: 0;"><strong>Prepared by:</strong></p>
            <p style="margin: 5px 0 0 0; color: #666;">HR Department</p>
        </div>
        <div style="text-align: center;">
            <div style="border-top: 1px solid #333; width: 200px; margin-top: 40px; padding-top: 5px;">
                <strong>Authorized Signatory</strong><br/>
                <span style="font-size: 11px; color: #666;">CEO / Managing Director</span>
            </div>
        </div>
    </div>
</div>`;
}

function renderEmploymentCertificate(emp: Employee, issuedDate: string, refNum: string): string {
    return `
<div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px 60px; color: #1a1a1a;">
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px double #1a365d; padding-bottom: 20px;">
        <h1 style="font-size: 28px; color: #1a365d; margin: 0; letter-spacing: 2px;">FIRST MEDICAL CENTER LLC</h1>
        <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Dubai, United Arab Emirates</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px;">
        <div><strong>Ref:</strong> ${refNum}</div>
        <div><strong>Date:</strong> ${formatDate(issuedDate)}</div>
    </div>

    <h2 style="text-align: center; font-size: 20px; text-decoration: underline; margin-bottom: 30px; color: #1a365d;">EMPLOYMENT CERTIFICATE</h2>

    <div style="line-height: 1.8; font-size: 14px;">
        <p><strong>To Whom It May Concern,</strong></p>

        <p>This is to certify that <strong>${emp.firstName} ${emp.lastName}</strong>, holder of Passport No. <strong>${emp.passportNumber || '—'}</strong>
        and Emirates ID No. <strong>${emp.emiratesId || '—'}</strong>,
        is currently employed with <strong>First Medical Center LLC</strong> as <strong>${emp.designation}</strong>
        in the <strong>${emp.department}</strong> department.</p>

        <p>Date of joining: <strong>${formatDate(emp.joiningDate)}</strong></p>

        <p>Employment type: <strong>${emp.employmentType === 'FULL_TIME' ? 'Full Time' : emp.employmentType === 'PART_TIME' ? 'Part Time' : 'Contract'}</strong></p>

        <p>This certificate is issued upon the request of the above-mentioned employee without any liability on the part of the company.</p>
    </div>

    <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px;">
        <div>
            <p style="margin: 0;"><strong>Prepared by:</strong></p>
            <p style="margin: 5px 0 0 0; color: #666;">HR Department</p>
        </div>
        <div style="text-align: center;">
            <div style="border-top: 1px solid #333; width: 200px; margin-top: 40px; padding-top: 5px;">
                <strong>Authorized Signatory</strong><br/>
                <span style="font-size: 11px; color: #666;">CEO / Managing Director</span>
            </div>
        </div>
    </div>
</div>`;
}

function renderExperienceCertificate(
    emp: Employee,
    issuedDate: string,
    refNum: string,
    endDate: string,
    sickLeaves: number,
    disciplinaryActions: string
): string {
    return `
<div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px 60px; color: #1a1a1a;">
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px double #1a365d; padding-bottom: 20px;">
        <h1 style="font-size: 28px; color: #1a365d; margin: 0; letter-spacing: 2px;">FIRST MEDICAL CENTER LLC</h1>
        <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Dubai, United Arab Emirates</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px;">
        <div><strong>Ref:</strong> ${refNum}</div>
        <div><strong>Date:</strong> ${formatDate(issuedDate)}</div>
    </div>

    <h2 style="text-align: center; font-size: 20px; text-decoration: underline; margin-bottom: 30px; color: #1a365d;">EXPERIENCE CERTIFICATE</h2>

    <div style="line-height: 1.8; font-size: 14px;">
        <p><strong>To Whom It May Concern,</strong></p>

        <p>This is to certify that <strong>${emp.firstName} ${emp.lastName}</strong>, holder of Passport No. <strong>${emp.passportNumber || '—'}</strong>,
        was employed with <strong>First Medical Center LLC</strong> as <strong>${emp.designation}</strong>
        in the <strong>${emp.department}</strong> department.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px; width: 40%;">Date of Joining</td>
                    <td style="padding: 8px 12px; font-weight: bold;">${formatDate(emp.joiningDate)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Last Working Day</td>
                    <td style="padding: 8px 12px; font-weight: bold;">${formatDate(endDate)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Designation</td>
                    <td style="padding: 8px 12px; font-weight: bold;">${emp.designation}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Sick Leaves Taken</td>
                    <td style="padding: 8px 12px; font-weight: bold;">${sickLeaves} day(s)</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px 12px;">Disciplinary Actions</td>
                    <td style="padding: 8px 12px; font-weight: bold;">${disciplinaryActions || 'None'}</td>
                </tr>
            </tbody>
        </table>

        <p style="margin-top: 10px; font-size: 11px; color: #888;">
            <em>Note: Suspension letters and warning letters are not considered as disciplinary actions for the purpose of this certificate.</em>
        </p>

        ${!disciplinaryActions ? '<p>During the tenure, the employee has demonstrated professional conduct and we wish them the best in their future endeavors.</p>' : ''}

        <p>This certificate is issued upon the request of the employee for whatever purpose it may serve.</p>
    </div>

    <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px;">
        <div>
            <p style="margin: 0;"><strong>Prepared by:</strong></p>
            <p style="margin: 5px 0 0 0; color: #666;">HR Department</p>
        </div>
        <div style="text-align: center;">
            <div style="border-top: 1px solid #333; width: 200px; margin-top: 40px; padding-top: 5px;">
                <strong>Authorized Signatory</strong><br/>
                <span style="font-size: 11px; color: #666;">CEO / Managing Director</span>
            </div>
        </div>
    </div>
</div>`;
}

// ── In-memory store ──
let letters: EmployeeLetter[] = [];
async function ensureLetLoaded() {
    
        letters = await loadFromBlob<EmployeeLetter[]>('hr-letters', []);
        
}

async function saveLet() {
    await saveToBlob('hr-letters', letters);
}

export const HRLettersStore = {
    getAll: async (filters?: { employeeId?: string; status?: LetterStatus; letterType?: LetterType }): Promise<EmployeeLetter[]> => {
        await ensureLetLoaded();
        let result = [...letters];
        if (filters?.employeeId) result = result.filter(l => l.employeeId === filters.employeeId);
        if (filters?.status) result = result.filter(l => l.status === filters.status);
        if (filters?.letterType) result = result.filter(l => l.letterType === filters.letterType);
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    getById: async (id: string): Promise<EmployeeLetter | undefined> => {
        await ensureLetLoaded();
        return letters.find(l => l.id === id);
    },

    generate: async (data: {
        employeeId: string;
        letterType: LetterType;
        generatedBy: string;
        issuedDate: string;
        endDate?: string;
        sickLeavesTaken?: number;
        disciplinaryActions?: string;
    }): Promise<EmployeeLetter | null> => {
        await ensureLetLoaded();
        const emp = await HRStore.getById(data.employeeId);
        if (!emp) return null;

        const refNum = getNextRefNumber(data.letterType);
        const now = new Date().toISOString();

        let content = '';
        switch (data.letterType) {
            case 'SALARY_CERTIFICATE':
                content = renderSalaryCertificate(emp, data.issuedDate, refNum);
                break;
            case 'EMPLOYMENT_CERTIFICATE':
                content = renderEmploymentCertificate(emp, data.issuedDate, refNum);
                break;
            case 'EXPERIENCE_CERTIFICATE':
                content = renderExperienceCertificate(
                    emp,
                    data.issuedDate,
                    refNum,
                    data.endDate || now,
                    data.sickLeavesTaken ?? emp.sickLeavesTaken ?? 0,
                    data.disciplinaryActions || ''
                );
                break;
        }

        const letter: EmployeeLetter = {
            id: `ltr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            referenceNumber: refNum,
            employeeId: data.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeCode: emp.employeeCode,
            letterType: data.letterType,
            status: 'PENDING_APPROVAL',
            issuedDate: data.issuedDate,
            generatedBy: data.generatedBy,
            endDate: data.endDate,
            sickLeavesTaken: data.sickLeavesTaken,
            disciplinaryActions: data.disciplinaryActions,
            content,
            createdAt: now,
            updatedAt: now,
        };

        letters.push(letter);
        await saveLet();
        return letter;
    },

    approve: async (id: string, approvedBy: string): Promise<EmployeeLetter | null> => {
        await ensureLetLoaded();
        const letter = letters.find(l => l.id === id);
        if (!letter || letter.status === 'APPROVED') return null;
        letter.status = 'APPROVED';
        letter.approvedBy = approvedBy;
        letter.approvedDate = new Date().toISOString();
        letter.updatedAt = new Date().toISOString();
        await saveLet();
        return letter;
    },

    reject: async (id: string, reason: string): Promise<EmployeeLetter | null> => {
        await ensureLetLoaded();
        const letter = letters.find(l => l.id === id);
        if (!letter) return null;
        letter.status = 'REJECTED';
        letter.rejectedReason = reason;
        letter.updatedAt = new Date().toISOString();
        await saveLet();
        return letter;
    },

    delete: async (id: string): Promise<boolean> => {
        await ensureLetLoaded();
        const idx = letters.findIndex(l => l.id === id);
        if (idx === -1) return false;
        letters.splice(idx, 1);
        await saveLet();
        return true;
    },
};
