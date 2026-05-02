import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { ClientsStore, Client } from './lib/clients-store';
import { PackagesStore } from './lib/packages-store';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function parseDateStr(dateStr: string | undefined): string {
    if (!dateStr) return new Date().toISOString();
    try {
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3 && parts[2].length === 4) { return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString(); }
        }
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3 && parts[2].length === 4) { return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString(); }
        }
        return new Date(dateStr).toISOString();
    } catch {
        return new Date().toISOString();
    }
}

async function loadClients() {
    console.log('Loading Client Report...');
    const csvData = fs.readFileSync(path.join(process.cwd(), 'imports', 'Client Report.csv'), 'utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    
    const newClients: Array<Partial<Client> & { id: string; name: string }> = [];
    for (const record of records) {
        const phone = record['Phone']?.trim();
        const name = record['Name']?.trim();
        const email = record['E-mail']?.trim();
        const id = record['File No']?.trim() || `sb-client-${Date.now()}-${Math.random()}`;
        if (!name) continue;
        newClients.push({ id, name, phone, email, source: 'simplybook', sbClientId: id });
    }
    const result = await ClientsStore.importStandaloneBatch(newClients);
    console.log(`Clients imported: ${result.added}, skipped: ${result.skipped}`);
}

async function loadPackages() {
    console.log('Loading Packages Report...');
    const csvData = fs.readFileSync(path.join(process.cwd(), 'imports', 'Packages Report.csv'), 'utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });

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
        
        newPackages.push({
            id: `cpkg-sb-${id}`,
            packageId: 'imported-sb-package',
            packageName: packageName,
            customerName: clientName,
            customerPhone: clientPhone || '',
            purchaseDate: parseDateStr(startDate),
            expiryDate: parseDateStr(endDate),
            remainingSessions: {}, totalSessions: {},
            active: status === 'active',
            paymentMethod: 'pay_at_clinic', paymentStatus: 'paid', source: 'simplybook'
        });
    }
    const result = await PackagesStore.importSimplyBookPackages(newPackages);
    console.log(`Packages imported: ${result.added}, skipped: ${result.skipped}`);
}

async function main() {
    await loadClients();
    await loadPackages();
    console.log('Migration completed successfully.');
}
main().catch(console.error);
