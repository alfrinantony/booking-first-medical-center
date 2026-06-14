import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normName(n: string) { return n.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function levenshtein(a: string, b: string): number {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

function matchDoctor(providerName: string, index: any[]) {
    const target = normName(providerName);
    if (!target) return null;

    let bestEntry = null;
    let bestScore = Infinity;
    let hasSubstringMatch = false;

    for (const entry of index) {
        if (entry.normalised === target) return entry;

        if (entry.normalised.includes(target) || target.includes(entry.normalised)) {
            const dist = levenshtein(entry.normalised, target);
            if (dist < bestScore || !hasSubstringMatch) { 
                bestScore = dist; 
                bestEntry = entry; 
                hasSubstringMatch = true;
            }
            continue;
        }

        if (!hasSubstringMatch) {
            const dist = levenshtein(entry.normalised, target);
            if (dist <= 3 && dist < bestScore) {
                bestScore = dist;
                bestEntry = entry;
            }
        }
    }
    return bestEntry;
}

async function run() {
    try {
        const blob = await prisma.blobStore.findUnique({ where: { key: 'clinics' } });
        if (!blob) return;
        const clinics = typeof blob.data === 'string' ? JSON.parse(blob.data) : blob.data;

        const doctorIndex = [];
        for (const clinic of clinics) {
            for (const dept of clinic.departments) {
                for (const doc of dept.doctors) {
                    doctorIndex.push({
                        doctorId: doc.id,
                        doctorName: doc.name,
                        normalised: normName(doc.name),
                        clinicId: clinic.id,
                        deptId: dept.id
                    });
                }
            }
        }

        const unmatched = await prisma.booking.findMany({
            where: { doctorId: 'sb-unmatched' },
            select: { id: true, sbProviderName: true }
        });

        console.log(`Found ${unmatched.length} unmatched bookings`);

        let updated = 0;
        for (const booking of unmatched) {
            if (!booking.sbProviderName) continue;
            const match = matchDoctor(booking.sbProviderName, doctorIndex);
            if (match) {
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: {
                        doctorId: match.doctorId,
                        clinicId: match.clinicId,
                        deptId: match.deptId
                    }
                });
                updated++;
            }
        }
        console.log(`Updated ${updated} bookings`);

    } catch(e) { console.error(e); } finally { await prisma.$disconnect(); }
}
run();
