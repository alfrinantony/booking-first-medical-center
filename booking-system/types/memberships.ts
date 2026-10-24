export interface AllowedProcedure {
    serviceId: string;
    serviceName: string;
    deptName?: string;
    clinicName?: string;
    sessionLimit: number; // -1 = unlimited, or positive integer (e.g. 5, 10)
    discountPercent: number; // 100 = 100% free / covered, 50 = 50% discount
    notes?: string;
}

export type PrivilegeCategory =
    | 'VIP Service'
    | 'Clinical Perk'
    | 'Courtesy Discount'
    | 'Amenity'
    | 'Priority Access';

export interface MembershipPrivilegeDef {
    id: string;
    title: string;
    category: PrivilegeCategory;
    description?: string;
    badgeColor?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MembershipTier {
    id: string;
    name: string; // Admin can name the membership freely
    code: string; // Short code, e.g. FMC-VIP-01
    description?: string;
    pictureUrl: string; // Picture / card image URL or data URL
    durationValue: number; // e.g. 1, 3, 6, 12, 30, 365
    durationUnit: 'days' | 'months' | 'years'; // Flexible duration unit
    price: number; // Base Price in AED (before VAT)
    vatRate: number; // VAT percentage, standard 5% in UAE
    vatAmount: number; // Calculated: price * vatRate / 100
    totalPrice: number; // Total with VAT: price + vatAmount
    privileges: string[]; // List of privileges/perks included in the membership
    allowedProcedures: AllowedProcedure[]; // Procedures/services included
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CustomerProcedureAllowance {
    serviceId: string;
    serviceName: string;
    deptName?: string;
    clinicName?: string;
    totalAllowed: number; // -1 = unlimited
    usedCount: number;
    remainingCount: number; // -1 = unlimited
    discountPercent: number;
}

export interface ProcedureUsageRecord {
    id: string;
    date: string; // ISO date
    serviceId: string;
    serviceName: string;
    doctorName?: string;
    clinicName?: string;
    recordedBy: string; // Staff/Admin who registered usage
    notes?: string;
}

export interface CustomerMembership {
    id: string;
    membershipTierId: string;
    membershipName: string;
    membershipCode: string;
    pictureUrl: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    clientId?: string;
    startDate: string; // ISO date
    expiryDate: string; // ISO date
    durationValue: number;
    durationUnit: 'days' | 'months' | 'years';
    price: number; // Base price
    vatRate: number; // VAT percentage applied
    vatAmount: number; // VAT amount
    totalPrice: number; // Total price paid
    paymentMethod: 'card' | 'cash' | 'bank_transfer' | 'online';
    paymentStatus: 'paid' | 'pending';
    invoiceId?: string;
    invoiceNumber?: string;
    status: 'active' | 'expired' | 'suspended' | 'cancelled';
    privileges: string[];
    allowedProcedures: CustomerProcedureAllowance[];
    usageHistory: ProcedureUsageRecord[];
    notes?: string;
    createdAt: string;
}
