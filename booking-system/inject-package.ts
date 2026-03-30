import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=stfmcbooking;AccountKey=iPSH3giG76MQjVIsbqbZAt2VuKeyRgFolm1hZz+yYTTfT9NGbP6xN7WhGQ5iyO8esH/9w0uwo6w9+AStxc+QPA==;BlobEndpoint=https://stfmcbooking.blob.core.windows.net/;FileEndpoint=https://stfmcbooking.file.core.windows.net/;QueueEndpoint=https://stfmcbooking.queue.core.windows.net/;TableEndpoint=https://stfmcbooking.table.core.windows.net/";

async function run() {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('fmc-data');

    const billingBlob = containerClient.getBlockBlobClient('billing.json');
    const billingData = JSON.parse((await billingBlob.downloadToBuffer()).toString());
    const targetInvoice = billingData.invoices.find((i: any) => i.invoiceNumber === "FMC-PKG-0002");
    
    if (!targetInvoice) {
        console.log("Invoice FMC-PKG-0002 not found!");
        return;
    }

    // Resolve accurate service ID
    const clinicsBlob = containerClient.getBlockBlobClient('clinics.json');
    const clinicsData = JSON.parse((await clinicsBlob.downloadToBuffer()).toString());
    let srv: any = null;
    for (const c of clinicsData) {
        for (const d of c.departments) {
            const hit = d.services?.find((s: any) => s.name === "Male Full Body Laser Hair Removal");
            if (hit) {
                srv = hit;
                break;
            }
        }
        if (srv) break;
    }

    if (!srv) {
        console.log("Could not find Male Full Body Laser Hair Removal service template!!");
        return;
    }

    const pkgsBlob = containerClient.getBlockBlobClient('packages.json');
    const pkgsData = JSON.parse((await pkgsBlob.downloadToBuffer()).toString());
    
    if (!pkgsData.availablePackages) pkgsData.availablePackages = [];
    if (!pkgsData.customerPackages) pkgsData.customerPackages = [];

    const existing = pkgsData.customerPackages.find((p: any) => p.packageId === `pkg-${srv.id}-3`);
    if (existing) {
        console.log("WAIT! Package already injected!");
        return;
    }

    const purchaseDate = new Date(targetInvoice.createdAt);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + 180);

    const injectedCustomerPackage = {
        id: `cpkg-${Date.now()}`,
        packageId: `pkg-${srv.id}-3`,
        packageName: "3 Sessions - Male Full Body Laser Hair Removal", // Dashboard displays this exact string minus " - 3 Sessions"
        customerName: targetInvoice.clientName,
        customerPhone: targetInvoice.clientPhone,
        purchaseDate: purchaseDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        remainingSessions: { [srv.id]: 3 },
        totalSessions: { [srv.id]: 3 },
        active: true,
        paymentMethod: "credit_card",
        paymentStatus: "paid",
        isCombo: false
    };

    // Make sure we also have an available template so everything resolves correctly
    if (!pkgsData.availablePackages.find((p: any) => p.id === injectedCustomerPackage.packageId)) {
        pkgsData.availablePackages.push({
            id: injectedCustomerPackage.packageId,
            name: injectedCustomerPackage.packageName,
            description: "3-session package for Male Full Body Laser Hair Removal. Valid for 180 days.",
            price: 1199,
            validityInDays: 180,
            active: true,
            source: "service",
            items: [{ serviceId: srv.id, serviceName: srv.name, count: 3 }]
        });
    }

    pkgsData.customerPackages.push(injectedCustomerPackage);

    const buffer = Buffer.from(JSON.stringify(pkgsData, null, 2), 'utf-8');
    await pkgsBlob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/json' } });
    
    console.log(`SUCCESSFULLY INJECTED PACKAGE FOR ALFRIN ANTONY (${targetInvoice.clientPhone})`);
}

run().catch(console.error);
