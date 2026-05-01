import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseDateStr(dateStr: string | undefined): string {
    if (!dateStr) return new Date().toISOString();
    try {
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3 && parts[2].length === 4) { // DD-MM-YYYY
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
            }
        }
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3 && parts[2].length === 4) { // DD/MM/YYYY
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
            }
        }
        return new Date(dateStr).toISOString();
    } catch {
        return new Date().toISOString();
    }
}

async function migrateBookingsFromCSV() {
    console.log('Loading Bookings directly from CSV to Supabase...');
    const files = [
        '2020_Booking Report.csv', '2021_Booking Report.csv', '2022_Booking Report.csv',
        '2023_Booking Report.csv', '2024_Booking Report.csv', '2025_Booking Report.csv',
        '2026_Booking Report.csv'
    ];
    
    let totalAdded = 0;

    for (const file of files) {
        const fullPath = path.join(process.cwd(), 'imports', file);
        if (!fs.existsSync(fullPath)) continue;
        console.log(`Processing ${file}...`);
        
        const csvData = fs.readFileSync(fullPath, 'utf8');
        const records = parse(csvData, { columns: true, skip_empty_lines: true });
        
        const payload = [];
        
        for (const record of records) {
            const dateStr = record['Date']?.trim();
            const timeStr = record['Time']?.trim();
            const service = record['Service']?.trim();
            const provider = record['Service provider']?.trim();
            const code = record['Code']?.trim();
            const clientPhone = record['Client phone']?.trim();
            const clientName = record['Client name']?.trim();
            const clientEmail = record['Client email']?.trim();
            const status = record['Status']?.trim();
            const price = parseFloat(record['Price']?.trim() || '0');
            const amount = parseFloat(record['Amount']?.trim() || '0');
            const currency = record['Currency']?.trim();
            const processor = record['Payment processor']?.trim();
            
            if (!code || !dateStr || !timeStr || !clientName) continue;
            
            let formattedDate = dateStr;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            
            payload.push({
                id: `sb-${code}`,
                clinicId: 'simplybook-import',
                deptId: 'simplybook-import',
                doctorId: 'sb-unmatched',
                serviceId: 'sb-unmatched',
                serviceName: service,
                date: formattedDate,
                slot: timeStr,
                patientName: clientName,
                whatsappNumber: clientPhone,
                email: clientEmail,
                status: status === 'cancelled' ? 'cancelled' : (status === 'arrived' ? 'completed' : 'confirmed'),
                amount: amount || price,
                sbInvoiceAmount: amount,
                sbInvoiceCurrency: currency,
                sbPaymentProcessor: processor,
                sbProviderName: provider,
                sbServiceName: service,
                createdAt: new Date().toISOString()
            });
        }
        
        // Insert chunks
        let chunks = [];
        for (let i = 0; i < payload.length; i += 5000) {
            chunks.push(payload.slice(i, i + 5000));
        }
        
        for (const chunk of chunks) {
            await prisma.booking.createMany({ data: chunk, skipDuplicates: true });
            totalAdded += chunk.length;
            console.log(`  -> Inserted chunk of ${chunk.length} (Total: ${totalAdded})`);
        }
    }
    console.log(`Completed Bookings CSV Migration. Total: ${totalAdded}`);
}

migrateBookingsFromCSV()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
