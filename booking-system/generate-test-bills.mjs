const apiUrl = 'http://localhost:3000/api/admin/billing';

const commonData = {
    clientName: 'Test Patient',
    clientPhone: '0501234567',
    clientEmail: 'test@example.com',
    clinicId: 'fmc-main',
    clinicName: 'Main Clinic',
    generatedBy: 'Admin Assistant',
    date: new Date().toISOString().split('T')[0],
};

async function createBill(data) {
    let retries = 15;
    while (retries > 0) {
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...commonData, ...data })
            });
            if (!res.ok) {
                console.error('Failed to create', data.invoiceCategory, await res.text());
                return null;
            } else {
                const body = await res.json();
                console.log('Created:', data.invoiceCategory, '-> Number:', body.invoiceNumber, '| Payments:', body.payments?.map(p => p.referenceNumber).join(', ') || 'None');
                return body;
            }
        } catch (e) {
            if (e.cause?.code === 'ECONNREFUSED') {
                console.log('Waiting for dev server to start on port 3000... (' + retries + ' attempts left)');
                await new Promise(r => setTimeout(r, 2000));
                retries--;
            } else {
                console.error('Error creating', data.invoiceCategory, e.message);
                return null;
            }
        }
    }
    console.error('Dev server did not start in time. Aborting.');
    process.exit(1);
}

async function run() {
    console.log('Connecting to dev server to generate test bills...');

    // 1. Single Session Invoice (SIV) - Cash
    const siv = await createBill({
        invoiceCategory: 'clinic_single',
        paymentMethod: 'cash',
        paymentConfirmed: true,
        paymentReceptionStatus: 'received',
        subtotal: 100,
        taxPercentage: 5,
        taxAmount: 5,
        totalAmount: 105,
        items: [{ description: 'General Consultation', quantity: 1, unitPrice: 100, total: 100 }]
    });

    // 2. Package Bill (PKG) - Card
    const pkg = await createBill({
        invoiceCategory: 'clinic_package',
        paymentMethod: 'card',
        paymentConfirmed: true,
        paymentReceptionStatus: 'received',
        subtotal: 500,
        taxPercentage: 5,
        taxAmount: 25,
        totalAmount: 525,
        items: [{ description: 'Laser Hair Removal Package (6 Sessions)', quantity: 1, unitPrice: 500, total: 500 }],
        packageDetails: 'Laser Hair Removal Package'
    });

    // 3. Package Session Bill (PIV) - No payment needed
    const piv = await createBill({
        invoiceCategory: 'package_session',
        paymentMethod: 'cash', 
        paymentConfirmed: true,
        paymentReceptionStatus: 'received',
        subtotal: 0,
        taxPercentage: 0,
        taxAmount: 0,
        totalAmount: 0,
        items: [{ description: 'Laser Hair Removal Session (1/6)', quantity: 1, unitPrice: 0, total: 0 }],
        packageDetails: 'Laser Hair Removal Package'
    });

    // 4. Refund (RFD)
    if (siv && siv.id) {
        try {
            console.log('\nRefunding Single Session Invoice (SIV)...');
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'refund',
                    invoiceId: siv.id,
                    refundedBy: 'Admin Assistant',
                    refundAmount: 105,
                    refundReason: 'Customer requested cancellation',
                    refundAccountName: 'Test Patient',
                    refundIban: 'AE12345678901234567890',
                    refundBankName: 'Test Bank'
                })
            });
            if (!res.ok) {
                console.error('Failed to refund', await res.text());
            } else {
                const body = await res.json();
                console.log('Refund successful -> Refund Document/Payment Ref:', body.invoice?.payments?.find(p => p.amount < 0)?.referenceNumber);
            }
        } catch (e) {
            console.error('Error refunding', e.message);
        }
    }
    
    console.log('\nDone! You can verify them on http://localhost:3000/admin/transactions');
}

run();
