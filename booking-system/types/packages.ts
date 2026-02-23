export interface PackageServiceItem {
    serviceId: string;
    serviceName: string; // Cached for display
    count: number; // Number of sessions included
}

export interface Package {
    id: string;
    name: string;
    description?: string;
    price: number;
    validityInDays: number;
    items: PackageServiceItem[];
    active: boolean;
    createdAt: string;
}

export interface CustomerPackage {
    id: string;
    packageId: string;
    packageName: string; // Cached
    customerName: string;
    customerPhone: string; // Unique identifier for now
    purchaseDate: string; // ISO Date
    expiryDate: string; // ISO Date
    remainingSessions: {
        [serviceId: string]: number; // Map serviceId -> count
    };
    active: boolean;
}
