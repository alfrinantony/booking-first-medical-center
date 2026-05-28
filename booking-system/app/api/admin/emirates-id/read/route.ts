export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import https from 'https';
import crypto from 'crypto';
import { mapToClientForm, EmiratesIdReadResult, EmiratesIdData } from '@/lib/emirates-id';

// Helper to normalize dates
function normalizeDate(dateStr?: string): string {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    const compactMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    return dateStr;
}

// Parse ICA full name
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

// Proxy function to read from 127.0.0.1:9004 natively bypassing SSL
function readFromToolkit(): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 9004,
            path: '/CardReader/ReadPublicData',
            method: 'GET',
            rejectUnauthorized: false,
            servername: 'toolkitagent.mohre.gov.ae',
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
            minVersion: 'TLSv1' as any,
            ciphers: 'ALL:@SECLEVEL=0',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON from Toolkit'));
                    }
                } else {
                    reject(new Error(`Toolkit responded with status ${res.statusCode}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Connection timed out'));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

export async function GET() {
    try {
        let raw: any;
        try {
            raw = await readFromToolkit();
        } catch (e) {
            console.error('[Emirates ID Proxy] Failed to read from physical toolkit:', e);
            // Fallback to local mock data logic or just return demo warning natively.
            // Let's return the demo payload to match previous behavior if reader is completely offline
            const demoData: EmiratesIdData = {
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
            };
            return NextResponse.json({
                success: true,
                isDemo: true,
                raw: demoData,
                formFields: mapToClientForm(demoData),
            });
        }

        if (raw.IsCardPresent === false) {
            return NextResponse.json({
                success: false,
                error: 'No Emirates ID card detected. Please insert the card into the reader.',
            }, { status: 400 });
        }

        const fullNameEn = raw.FullNameEnglish || raw.fullNameEnglish || '';
        const fullNameAr = raw.FullNameArabic || raw.fullNameArabic || '';
        const enParts = parseFullName(fullNameEn);
        const arParts = parseFullName(fullNameAr);

        const data: EmiratesIdData = {
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

        if (!data.idNumber && !data.fullNameEnglish) {
            return NextResponse.json({
                success: false,
                error: 'Card was read but no data was returned. Please re-insert the card.',
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            isDemo: false,
            raw: data,
            formFields: mapToClientForm(data),
        });
    } catch (error) {
        console.error('[Emirates ID API] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error while reading Emirates ID.',
        }, { status: 500 });
    }
}
