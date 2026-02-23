/**
 * Emirates ID Smart Card Reader Integration
 *
 * Uses the ICA (Identity & Citizenship Authority) Toolkit local service
 * to read data from an Emirates ID card via a USB smart card reader.
 *
 * The ICA Toolkit must be installed on the clinic PC and running as a service.
 * Download from: https://icp.gov.ae
 *
 * Fallback: demo mode returns sample data for testing/development.
 */

export interface EmiratesIdData {
    idNumber: string;           // e.g. 784-1990-1234567-1
    fullNameEnglish: string;
    fullNameArabic: string;
    firstNameEnglish: string;
    middleNameEnglish: string;
    lastNameEnglish: string;
    firstNameArabic: string;
    lastNameArabic: string;
    dateOfBirth: string;        // YYYY-MM-DD
    gender: string;             // Male / Female
    nationality: string;        // e.g. Indian, Pakistani, Emirati
    issueDate: string;          // YYYY-MM-DD
    expiryDate: string;         // YYYY-MM-DD
    cardNumber: string;
    photo?: string;             // Base64 JPEG
    occupation?: string;
}

export interface EmiratesIdReadResult {
    success: boolean;
    data?: EmiratesIdData;
    error?: string;
    isDemo?: boolean;           // true if demo/fallback data was used
}

// ── ICA Toolkit response shape (common fields) ──
interface IcaToolkitResponse {
    IsCardPresent?: boolean;
    IdNumber?: string;
    CardNumber?: string;
    FullNameEnglish?: string;
    FullNameArabic?: string;
    DateOfBirth?: string;
    Gender?: string;
    Nationality?: string;
    IssueDate?: string;
    ExpiryDate?: string;
    Occupation?: string;
    Photo?: string;
    // Some toolkit versions use different casing
    idNumber?: string;
    cardNumber?: string;
    fullNameEnglish?: string;
    fullNameArabic?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    issueDate?: string;
    expiryDate?: string;
    occupation?: string;
    photo?: string;
}

/**
 * Parse a full name string into first / middle / last parts.
 */
function parseFullName(fullName: string): { first: string; middle: string; last: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
    if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
    return {
        first: parts[0],
        middle: parts.slice(1, -1).join(' '),
        last: parts[parts.length - 1],
    };
}

/**
 * Normalize a date string from various formats to YYYY-MM-DD.
 */
function normalizeDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // DD/MM/YYYY
    const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    // YYYYMMDD
    const compactMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    return dateStr;
}

/**
 * Parse ICA Toolkit response into our standard EmiratesIdData.
 */
function parseIcaResponse(raw: IcaToolkitResponse): EmiratesIdData {
    const fullNameEn = raw.FullNameEnglish || raw.fullNameEnglish || '';
    const fullNameAr = raw.FullNameArabic || raw.fullNameArabic || '';
    const enParts = parseFullName(fullNameEn);
    const arParts = parseFullName(fullNameAr);

    return {
        idNumber: raw.IdNumber || raw.idNumber || '',
        fullNameEnglish: fullNameEn,
        fullNameArabic: fullNameAr,
        firstNameEnglish: enParts.first,
        middleNameEnglish: enParts.middle,
        lastNameEnglish: enParts.last,
        firstNameArabic: arParts.first,
        lastNameArabic: arParts.last,
        dateOfBirth: normalizeDate(raw.DateOfBirth || raw.dateOfBirth),
        gender: (raw.Gender || raw.gender || '').toLowerCase() === 'f' ? 'Female' : (raw.Gender || raw.gender || '').toLowerCase() === 'm' ? 'Male' : (raw.Gender || raw.gender || ''),
        nationality: raw.Nationality || raw.nationality || '',
        issueDate: normalizeDate(raw.IssueDate || raw.issueDate),
        expiryDate: normalizeDate(raw.ExpiryDate || raw.expiryDate),
        cardNumber: raw.CardNumber || raw.cardNumber || '',
        photo: raw.Photo || raw.photo || undefined,
        occupation: raw.Occupation || raw.occupation || undefined,
    };
}

/**
 * Attempt to read the Emirates ID card via the ICA Toolkit local service.
 */
export async function readEmiratesId(toolkitUrl?: string): Promise<EmiratesIdReadResult> {
    const baseUrl = toolkitUrl || process.env.EMIRATES_ID_TOOLKIT_URL || 'http://localhost:9694';

    try {
        // Common ICA Toolkit endpoints — try in order
        const endpoints = [
            `${baseUrl}/CardReader/ReadPublicData`,
            `${baseUrl}/eid/ReadPublicData`,
            `${baseUrl}/api/ReadCard`,
            `${baseUrl}/ReadCard`,
        ];

        let lastError = '';
        for (const endpoint of endpoints) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(endpoint, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' },
                });
                clearTimeout(timeout);

                if (res.ok) {
                    const raw: IcaToolkitResponse = await res.json();

                    // Check if card is present
                    if (raw.IsCardPresent === false) {
                        return { success: false, error: 'No Emirates ID card detected. Please insert the card into the reader.' };
                    }

                    const data = parseIcaResponse(raw);

                    // Validate we got at least an ID number
                    if (!data.idNumber && !data.fullNameEnglish) {
                        lastError = 'Card was read but no data was returned. Please re-insert the card.';
                        continue;
                    }

                    return { success: true, data };
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    lastError = 'Connection timed out.';
                } else {
                    lastError = `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
                }
            }
        }

        // All endpoints failed — return demo data for development
        console.warn('[Emirates ID] ICA Toolkit not reachable, returning demo data.');
        return getDemoData();

    } catch (error) {
        console.error('[Emirates ID] Unexpected error:', error);
        return getDemoData();
    }
}

/**
 * Returns demo/sample data for development and testing purposes.
 */
function getDemoData(): EmiratesIdReadResult {
    return {
        success: true,
        isDemo: true,
        data: {
            idNumber: '784-1990-1234567-1',
            fullNameEnglish: 'Mohammed Ahmed Al Maktoum',
            fullNameArabic: 'محمد أحمد آل مكتوم',
            firstNameEnglish: 'Mohammed',
            middleNameEnglish: 'Ahmed',
            lastNameEnglish: 'Al Maktoum',
            firstNameArabic: 'محمد',
            lastNameArabic: 'آل مكتوم',
            dateOfBirth: '1990-05-15',
            gender: 'Male',
            nationality: 'Emirati',
            issueDate: '2023-01-10',
            expiryDate: '2028-01-10',
            cardNumber: 'EID-20230110-001',
            occupation: 'Engineer',
        },
    };
}

/**
 * Map Emirates ID data to the client registration form fields.
 */
export function mapToClientForm(data: EmiratesIdData): Record<string, string> {
    return {
        firstName: data.firstNameEnglish,
        middleName: data.middleNameEnglish,
        lastName: data.lastNameEnglish,
        firstNameArabic: data.firstNameArabic,
        lastNameArabic: data.lastNameArabic,
        emiratesIdNumber: data.idNumber,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        emiratesIdIssueDate: data.issueDate,
        emiratesIdExpiryDate: data.expiryDate,
        profession: data.occupation || '',
    };
}
