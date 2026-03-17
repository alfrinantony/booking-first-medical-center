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
    source?: 'admin' | 'service'; // 'admin' = created in Admin Packages, 'service' = auto-created from service purchase
    createdAt: string;
}

export interface ComplimentaryService {
    serviceId: string;
    serviceName: string;
    recipientPhone?: string; // If transferred to friend/family
    used: boolean;
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
    totalSessions: {
        [serviceId: string]: number; // Original count for "Session X of Y"
    };
    active: boolean;
    // Payment fields
    paymentMethod: 'pay_at_clinic' | 'credit_card';
    paymentStatus: 'pending' | 'paid';
    // Transfer fields
    transferredFrom?: string;       // Original owner phone
    transferReason?: string;        // Reason for transfer
    isTransferred?: boolean;        // Once true, cannot be transferred again
    // Freeze fields
    isFrozen?: boolean;
    frozenAt?: string;              // ISO date when frozen
    freezeReason?: 'medical' | 'pregnancy_breastfeeding';
    freezeDocumentName?: string;    // Name of medical document
    hasBeenFrozen?: boolean;        // true after first freeze, prevents re-freeze
    // Complimentary services
    complimentaryServices?: ComplimentaryService[];
    // Combo indicator
    isCombo?: boolean;
}

export interface ComboPackage extends Package {
    isCombo: true;
}
