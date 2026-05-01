import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { loadFromBlob } from '../lib/blob-persistence';

const prisma = new PrismaClient();

async function main() {
    console.log('Migrating data from Azure Blob to Supabase PostgreSQL...');

    // 1. Migrate Generic Stores to BlobStore
    const stores = [
        'packages', 'medicines', 'services', 'clinics', 'adminUsers', 
        'permissions', 'logs', 'settings', 'promos', 'reviews'
    ];
    for (const key of stores) {
        console.log(`Migrating ${key}...`);
        try {
            const data = await loadFromBlob<any>(key, null);
            if (data) {
                await prisma.blobStore.upsert({
                    where: { key },
                    update: { data },
                    create: { key, data }
                });
                console.log(` -> Saved ${key} to Supabase BlobStore`);
            }
        } catch (e) {
            console.log(` -> Failed or missing ${key}`);
        }
    }

    // 2. Migrate Clients
    console.log('Migrating standalone clients...');
    const clientsData = await loadFromBlob<any>('standalone-clients', {});
    const clientsList = Object.values(clientsData || {});
    
    let clientChunks = [];
    for (let i = 0; i < clientsList.length; i += 5000) {
        clientChunks.push(clientsList.slice(i, i + 5000));
    }
    
    let cCount = 0;
    for (const chunk of clientChunks) {
        const payload = chunk.map((c: any) => ({
            id: c.id,
            name: c.name || 'Unknown',
            firstName: c.firstName,
            middleName: c.middleName,
            lastName: c.lastName,
            phone: c.phone || c.mobile,
            email: c.email,
            // mapping ...
            source: c.source,
            sbClientId: c.sbClientId,
            totalBookings: c.totalBookings || 0,
            lastBookingDate: c.lastBookingDate,
        }));
        await prisma.client.createMany({ data: payload, skipDuplicates: true });
        cCount += chunk.length;
        console.log(` -> Inserted ${cCount}/${clientsList.length} clients`);
    }

    // 3. Migrate Bookings
    console.log('Loading Bookings (this may take a bit, 220MB file)...');
    const bookingsData = await loadFromBlob<any[]>('bookings', []);
    
    let bChunks = [];
    for (let i = 0; i < bookingsData.length; i += 5000) {
        bChunks.push(bookingsData.slice(i, i + 5000));
    }

    let bCount = 0;
    for (const chunk of bChunks) {
        const payload = chunk.map((b: any) => ({
            id: b.id || Math.random().toString(36).substr(2,9),
            clinicId: b.clinicId || '',
            deptId: b.deptId || '',
            doctorId: b.doctorId || '',
            serviceId: b.serviceId || '',
            serviceName: b.serviceName,
            date: b.date || '',
            slot: b.slot || '',
            duration: b.duration || 30,
            patientName: b.patientName || 'Unknown',
            whatsappNumber: b.whatsappNumber,
            email: b.email,
            status: b.status || 'booked',
            amount: b.amount,
            
            selectedMedicineIds: b.selectedMedicineIds,
            statusHistory: b.statusHistory,
            billingStatus: b.billingStatus,
            
            sbId: b.sbId,
            sbInvoiceNumber: b.sbInvoiceNumber,
            sbInvoiceAmount: b.sbInvoiceAmount,
            sbPaymentProcessor: b.sbPaymentProcessor,
            sbPaymentStatus: b.sbPaymentStatus,
            sbProviderName: b.sbProviderName,
            sbServiceName: b.sbServiceName,
            
            createdAt: b.createdAt || new Date().toISOString(),
            anyDoctor: b.anyDoctor || false
        }));

        await prisma.booking.createMany({ data: payload, skipDuplicates: true });
        bCount += chunk.length;
        console.log(` -> Inserted ${bCount}/${bookingsData.length} bookings`);
    }

    console.log('Migration Complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
