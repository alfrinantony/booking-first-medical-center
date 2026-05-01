import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { ClientsStore, Client } from '../lib/clients-store';
import { BookingsStore } from '../lib/bookings-store';
import { PackagesStore } from '../lib/packages-store';

// Load environment variables for Azure Blob connection string
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

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

async function loadClients() {
    console.log('Loading Client Report...');
    const csvData = fs.readFileSync(path.join(process.cwd(), 'imports', 'Client Report.csv'), 'utf8');
    const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
    });
    
    const newClients: Array<Partial<Client> & { id: string; name: string }> = [];

    for (const record of records) {
        const phone = record['Phone']?.trim();
        const name = record['Name']?.trim();
        const email = record['E-mail']?.trim();
        const id = record['File No']?.trim() || `sb-client-${Date.now()}-${Math.random()}`;
        
        if (!name) continue;

        newClients.push({
            id,
            name,
            phone,
            email,
            source: 'simplybook',
            sbClientId: id,
        });
    }
    
    const result = await ClientsStore.importStandaloneBatch(newClients);
    console.log(`Clients imported: ${result.added}, skipped: ${result.skipped}`);
}

async function loadPackages() {
    console.log('Loading Packages Report...');
    const csvData = fs.readFileSync(path.join(process.cwd(), 'imports', 'Packages Report.csv'), 'utf8');
    const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
    });

    const newPackages: any[] = [];
    for (const record of records) {
        const id = record['id']?.trim();
        const packageName = record['Package name']?.trim();
        const clientName = record['Client name']?.trim();
        const clientPhone = record['Client phone']?.trim();
        const startDate = record['Period starts']?.trim();
        const endDate = record['Period ends']?.trim();
        const status = record['Status']?.trim();
        
        if (!id || !packageName || !clientName) continue;
        
        const newId = `cpkg-sb-${id}`;
        
        newPackages.push({
            id: newId,
            packageId: 'imported-sb-package',
            packageName: packageName,
            customerName: clientName,
            customerPhone: clientPhone || '',
            purchaseDate: parseDateStr(startDate),
            expiryDate: parseDateStr(endDate),
            remainingSessions: {},
            totalSessions: {},
            active: status === 'active',
            paymentMethod: 'pay_at_clinic',
            paymentStatus: 'paid',
            source: 'simplybook'
        });
    }
    
    const result = await PackagesStore.importSimplyBookPackages(newPackages);
    console.log(`Packages imported: ${result.added}, skipped: ${result.skipped}`);
}

async function loadBookings() {
    console.log('Loading Bookings Report...');
    // We should loop over all 202* files but let's just do an array of files
    const files = [
        '2020_Booking Report.csv',
        '2021_Booking Report.csv',
        '2022_Booking Report.csv',
        '2023_Booking Report.csv',
        '2024_Booking Report.csv',
        '2025_Booking Report.csv',
        '2026_Booking Report.csv',
    ];
    
    let totalAdded = 0;
    let totalSkipped = 0;

    for (const file of files) {
        const fullPath = path.join(process.cwd(), 'imports', file);
        if (!fs.existsSync(fullPath)) {
            console.log(`Skipping ${file} - not found`);
            continue;
        }
        console.log(`Processing ${file}...`);
        
        const csvData = fs.readFileSync(fullPath, 'utf8');
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true,
        });
        
        const incoming: any[] = [];
        
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
            // SimplyBook typically uses YYYY-MM-DD but let's be safe
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            
            incoming.push({
                sbId: code,
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
        
        const result = await BookingsStore.addSimplyBookBatch(incoming);
        console.log(`  -> ${file}: imported ${result.added}, skipped ${result.skipped}`);
        totalAdded += result.added;
        totalSkipped += result.skipped;
    }
    
    console.log(`Total Bookings imported: ${totalAdded}, skipped: ${totalSkipped}`);
}

async function main() {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
        console.error('Missing AZURE_STORAGE_CONNECTION_STRING');
        return;
    }
    
    await loadClients();
    await loadPackages();
    await loadBookings();
    
    console.log('Migration completed successfully.');
}

main().catch(console.error);
