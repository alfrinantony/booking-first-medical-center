// ─────────────────────────────────────────────────────────────
// Memberships Store — Tier configuration & Client Memberships with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { MembershipTier, CustomerMembership, CustomerProcedureAllowance, ProcedureUsageRecord, MembershipPrivilegeDef } from '@/types/memberships';
import { addDays, addMonths, addYears, isAfter, parseISO } from 'date-fns';
import { BillingStore } from './billing-store';

interface MembershipsData {
    tiers: MembershipTier[];
    customerMemberships: CustomerMembership[];
    privileges?: MembershipPrivilegeDef[];
}

let tiers: MembershipTier[] = [];
let customerMemberships: CustomerMembership[] = [];
let privileges: MembershipPrivilegeDef[] = [];

// ── Default Initial Privileges ──
const INITIAL_PRIVILEGES: MembershipPrivilegeDef[] = [
    {
        id: 'priv-priority-hotline',
        title: 'Dedicated Priority Doctor Hotline & Walk-in Fast-track Access',
        category: 'Priority Access',
        description: 'Direct VIP phone line and WhatsApp concierge for immediate scheduling without wait time.',
        badgeColor: 'amber',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'priv-valet-parking',
        title: 'Complimentary Valet Parking across all FMC Clinics',
        category: 'Amenity',
        description: 'Free dedicated valet parking at Al Muraqabat, Al Qiyadah, and Silicon Oasis branches.',
        badgeColor: 'blue',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'priv-skin-dental-analysis',
        title: 'Full Digital Skin Health & Dental Analysis on every visit',
        category: 'Clinical Perk',
        description: 'Advanced 3D facial imaging and digital dental intraoral examination included at zero charge.',
        badgeColor: 'emerald',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'priv-pharmacy-discount',
        title: '15% Courtesy Discount on Pharmacy & Laboratory Tests',
        category: 'Courtesy Discount',
        description: 'Special 15% reduction on all diagnostic blood tests, prescribed medications, and medical cosmetics.',
        badgeColor: 'purple',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'priv-vip-lounge',
        title: 'Exclusive VIP Concierge Lounge Access & Refreshments',
        category: 'VIP Service',
        description: 'Private waiting suite with complimentary artisan refreshments, high-speed Wi-Fi, and personalized assistant.',
        badgeColor: 'rose',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'priv-free-consult',
        title: 'Free Aesthetic Consultation prior to any session',
        category: 'Clinical Perk',
        description: 'Comprehensive doctor evaluation before starting any laser, aesthetic, or dermatology treatment.',
        badgeColor: 'teal',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    }
];

// ── Default Initial Tiers ──
const INITIAL_TIERS: MembershipTier[] = [
    {
        id: 'tier-diamond-vip',
        name: 'Diamond VIP Care Pass',
        code: 'FMC-VIP-01',
        description: 'Elite all-inclusive medical, aesthetic, and dental membership with executive priority booking.',
        pictureUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
        durationValue: 1,
        durationUnit: 'years',
        price: 5000,
        vatRate: 5,
        vatAmount: 250,
        totalPrice: 5250,
        privileges: [
            'Dedicated Priority Doctor Hotline & Fast-track Access',
            'Complimentary Valet Parking across all FMC branches',
            'Full Digital Skin Health & Dental Analysis on every visit',
            '15% Courtesy discount on additional Lab tests & Pharmacy items',
            'Exclusive VIP Concierge Lounge Access'
        ],
        allowedProcedures: [
            {
                serviceId: 'svc-hydrafacial',
                serviceName: 'HydraFacial Deluxe & LED Therapy',
                deptName: 'Dermatology & Aesthetics',
                clinicName: 'First Medical Center',
                sessionLimit: 4,
                discountPercent: 100,
                notes: '1 session per quarter'
            },
            {
                serviceId: 'svc-dental-clean',
                serviceName: 'Teeth Scaling, Polishing & Fluoride',
                deptName: 'Dental Care',
                clinicName: 'First Medical Center',
                sessionLimit: 2,
                discountPercent: 100,
                notes: 'Bi-annual preventative cleaning'
            },
            {
                serviceId: 'svc-gp-checkup',
                serviceName: 'GP Consultation & Full Body Vitals',
                deptName: 'General Practice',
                clinicName: 'First Medical Center',
                sessionLimit: -1, // Unlimited
                discountPercent: 100,
                notes: 'Unlimited visits with general practitioner'
            }
        ],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'tier-gold-aesthetics',
        name: 'Gold Aesthetics & Dental Club',
        code: 'FMC-GLD-02',
        description: 'Comprehensive 6-month aesthetic rejuvenation & oral health maintenance membership.',
        pictureUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
        durationValue: 6,
        durationUnit: 'months',
        price: 2800,
        vatRate: 5,
        vatAmount: 140,
        totalPrice: 2940,
        privileges: [
            'Priority Clinician Booking & WhatsApp Concierge',
            'Free Aesthetic Consultation prior to any session',
            '10% Discount on retail skincare & dental care products'
        ],
        allowedProcedures: [
            {
                serviceId: 'svc-carbon-laser',
                serviceName: 'Carbon Spectra Laser Hollywood Peel',
                deptName: 'Dermatology & Aesthetics',
                clinicName: 'First Medical Center',
                sessionLimit: 3,
                discountPercent: 100,
                notes: 'Every 8 weeks'
            },
            {
                serviceId: 'svc-dental-clean',
                serviceName: 'Teeth Scaling & Deep Polishing',
                deptName: 'Dental Care',
                clinicName: 'First Medical Center',
                sessionLimit: 2,
                discountPercent: 100,
                notes: 'Every 3 months'
            }
        ],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'tier-executive-wellness',
        name: 'Executive Wellness Monthly Pass',
        code: 'FMC-MNTH-03',
        description: 'Flexible 30-day medical privilege pass with unlimited GP consultations and vital monitoring.',
        pictureUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
        durationValue: 1,
        durationUnit: 'months',
        price: 800,
        vatRate: 5,
        vatAmount: 40,
        totalPrice: 840,
        privileges: [
            'Same-day Doctor walk-in appointment access',
            'Complimentary BP, Blood Sugar & BMI vitals monitoring',
            'Prescription refill delivery coordination'
        ],
        allowedProcedures: [
            {
                serviceId: 'svc-gp-checkup',
                serviceName: 'GP Consultation & Vitals Review',
                deptName: 'General Practice',
                clinicName: 'First Medical Center',
                sessionLimit: -1, // Unlimited
                discountPercent: 100,
                notes: 'Unlimited consultations during the active month'
            }
        ],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    }
];

async function ensureMembershipsLoaded() {
    const data = await loadFromBlob<MembershipsData>('memberships', {
        tiers: INITIAL_TIERS,
        customerMemberships: [],
        privileges: INITIAL_PRIVILEGES
    });

    tiers = data.tiers && data.tiers.length > 0 ? data.tiers : INITIAL_TIERS;
    customerMemberships = data.customerMemberships || [];
    privileges = data.privileges && data.privileges.length > 0 ? data.privileges : INITIAL_PRIVILEGES;

    // Automatically check and update expired memberships
    const now = new Date();
    let hasChanges = false;
    for (const cm of customerMemberships) {
        if (cm.status === 'active' && cm.expiryDate) {
            try {
                if (isAfter(now, parseISO(cm.expiryDate))) {
                    cm.status = 'expired';
                    hasChanges = true;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    if (hasChanges) {
        await saveMemberships();
    }
}

async function saveMemberships() {
    await saveToBlob<MembershipsData>('memberships', { tiers, customerMemberships, privileges });
}

// Helper to compute expiry date from start date and duration
export function calculateExpiryDate(startDateIso: string, durationValue: number, durationUnit: 'days' | 'months' | 'years'): string {
    const start = parseISO(startDateIso);
    let expiry: Date;
    switch (durationUnit) {
        case 'years':
            expiry = addYears(start, durationValue);
            break;
        case 'months':
            expiry = addMonths(start, durationValue);
            break;
        case 'days':
        default:
            expiry = addDays(start, durationValue);
            break;
    }
    return expiry.toISOString();
}

export const MembershipsStore = {
    // ── Tier Management ──
    getTiers: async (includeInactive: boolean = false): Promise<MembershipTier[]> => {
        await ensureMembershipsLoaded();
        if (includeInactive) return tiers;
        return tiers.filter(t => t.active);
    },

    getTierById: async (id: string): Promise<MembershipTier | undefined> => {
        await ensureMembershipsLoaded();
        return tiers.find(t => t.id === id);
    },

    createTier: async (tierData: Omit<MembershipTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<MembershipTier> => {
        await ensureMembershipsLoaded();

        const vatRate = typeof tierData.vatRate === 'number' ? tierData.vatRate : 5;
        const price = Number(tierData.price) || 0;
        const vatAmount = Number(((price * vatRate) / 100).toFixed(2));
        const totalPrice = Number((price + vatAmount).toFixed(2));

        const newTier: MembershipTier = {
            ...tierData,
            id: `tier-${Date.now()}`,
            vatRate,
            price,
            vatAmount,
            totalPrice,
            active: tierData.active !== undefined ? tierData.active : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        tiers.push(newTier);
        await saveMemberships();
        return newTier;
    },

    updateTier: async (id: string, updates: Partial<MembershipTier>): Promise<MembershipTier | null> => {
        await ensureMembershipsLoaded();
        const index = tiers.findIndex(t => t.id === id);
        if (index === -1) return null;

        const current = tiers[index];
        const price = updates.price !== undefined ? Number(updates.price) : current.price;
        const vatRate = updates.vatRate !== undefined ? Number(updates.vatRate) : current.vatRate;
        const vatAmount = Number(((price * vatRate) / 100).toFixed(2));
        const totalPrice = Number((price + vatAmount).toFixed(2));

        tiers[index] = {
            ...current,
            ...updates,
            price,
            vatRate,
            vatAmount,
            totalPrice,
            updatedAt: new Date().toISOString()
        };

        await saveMemberships();
        return tiers[index];
    },

    deleteTier: async (id: string): Promise<boolean> => {
        await ensureMembershipsLoaded();
        const initialLength = tiers.length;
        tiers = tiers.filter(t => t.id !== id);
        if (tiers.length !== initialLength) {
            await saveMemberships();
            return true;
        }
        return false;
    },

    // ── Customer Membership Management ──
    getCustomerMemberships: async (query?: {
        phone?: string;
        customerName?: string;
        status?: string;
    }): Promise<CustomerMembership[]> => {
        await ensureMembershipsLoaded();
        let results = [...customerMemberships];

        if (query?.phone) {
            const p = query.phone.replace(/[^0-9]/g, '');
            results = results.filter(cm => cm.customerPhone.replace(/[^0-9]/g, '').includes(p));
        }

        if (query?.customerName) {
            const nameLower = query.customerName.toLowerCase();
            results = results.filter(cm => cm.customerName.toLowerCase().includes(nameLower));
        }

        if (query?.status) {
            results = results.filter(cm => cm.status === query.status);
        }

        // Sort by createdAt descending
        return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    getCustomerMembershipById: async (id: string): Promise<CustomerMembership | undefined> => {
        await ensureMembershipsLoaded();
        return customerMemberships.find(cm => cm.id === id);
    },

    assignMembership: async (params: {
        membershipTierId: string;
        customerName: string;
        customerPhone: string;
        customerEmail?: string;
        clientId?: string;
        startDate?: string;
        paymentMethod: 'card' | 'cash' | 'bank_transfer' | 'online';
        paymentConfirmed?: boolean;
        staffName?: string;
        notes?: string;
    }): Promise<{ customerMembership: CustomerMembership; invoiceNumber?: string }> => {
        await ensureMembershipsLoaded();

        const tier = tiers.find(t => t.id === params.membershipTierId);
        if (!tier) {
            throw new Error('Membership tier not found');
        }

        const startDate = params.startDate ? new Date(params.startDate).toISOString() : new Date().toISOString();
        const expiryDate = calculateExpiryDate(startDate, tier.durationValue, tier.durationUnit);

        // Build customer procedure allowances
        const allowances: CustomerProcedureAllowance[] = (tier.allowedProcedures || []).map(proc => ({
            serviceId: proc.serviceId,
            serviceName: proc.serviceName,
            deptName: proc.deptName,
            clinicName: proc.clinicName,
            totalAllowed: proc.sessionLimit,
            usedCount: 0,
            remainingCount: proc.sessionLimit,
            discountPercent: proc.discountPercent ?? 100
        }));

        const membershipCode = `${tier.code}-${Date.now().toString().slice(-4)}`;
        const staff = params.staffName || 'Admin';

        // 1. Generate Invoice with VAT breakdown
        let invoiceId: string | undefined;
        let invoiceNumber: string | undefined;

        try {
            const durationLabel = `${tier.durationValue} ${tier.durationUnit}`;
            const procedureSummary = (tier.allowedProcedures || [])
                .map(p => `${p.serviceName} (${p.sessionLimit === -1 ? 'Unlimited' : `${p.sessionLimit} sess.`})`)
                .join(', ');

            const inv = await BillingStore.createInvoice({
                invoiceCategory: 'clinic_package',
                clientName: params.customerName,
                clientPhone: params.customerPhone,
                clientEmail: params.customerEmail,
                items: [
                    {
                        description: `Membership: ${tier.name} (${durationLabel}) — Incl: ${procedureSummary || 'Covered Procedures'}`,
                        quantity: 1,
                        unitPrice: tier.price,
                        total: tier.price
                    }
                ],
                packageDetails: `${tier.name} (Membership)`,
                subtotal: tier.price,
                taxPercentage: tier.vatRate,
                taxAmount: tier.vatAmount,
                totalAmount: tier.totalPrice,
                paymentMethod: params.paymentMethod,
                paymentConfirmed: params.paymentConfirmed !== false,
                paymentReceivedBy: staff,
                paymentReceptionStatus: params.paymentConfirmed !== false ? 'received' : 'pending',
                generatedBy: staff,
                date: startDate.split('T')[0],
                notes: `Client Membership Enrollment — ${tier.name} (${membershipCode}) — Valid until ${new Date(expiryDate).toLocaleDateString()}`
            });

            invoiceId = inv.id;
            invoiceNumber = inv.invoiceNumber;
        } catch (invoiceErr) {
            console.error('[MembershipsStore] Invoice generation error:', invoiceErr);
        }

        const newCustomerMembership: CustomerMembership = {
            id: `cmem-${Date.now()}`,
            membershipTierId: tier.id,
            membershipName: tier.name,
            membershipCode,
            pictureUrl: tier.pictureUrl,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            customerEmail: params.customerEmail,
            clientId: params.clientId,
            startDate,
            expiryDate,
            durationValue: tier.durationValue,
            durationUnit: tier.durationUnit,
            price: tier.price,
            vatRate: tier.vatRate,
            vatAmount: tier.vatAmount,
            totalPrice: tier.totalPrice,
            paymentMethod: params.paymentMethod,
            paymentStatus: params.paymentConfirmed !== false ? 'paid' : 'pending',
            invoiceId,
            invoiceNumber,
            status: 'active',
            privileges: tier.privileges || [],
            allowedProcedures: allowances,
            usageHistory: [],
            notes: params.notes,
            createdAt: new Date().toISOString()
        };

        customerMemberships.unshift(newCustomerMembership);
        await saveMemberships();

        return { customerMembership: newCustomerMembership, invoiceNumber };
    },

    useProcedureSession: async (
        customerMembershipId: string,
        serviceId: string,
        details: {
            doctorName?: string;
            clinicName?: string;
            recordedBy?: string;
            notes?: string;
        }
    ): Promise<{ success: boolean; message: string; remaining?: number | 'unlimited' }> => {
        await ensureMembershipsLoaded();

        const index = customerMemberships.findIndex(cm => cm.id === customerMembershipId);
        if (index === -1) {
            return { success: false, message: 'Client membership record not found.' };
        }

        const cm = customerMemberships[index];

        if (cm.status !== 'active') {
            return { success: false, message: `Membership is currently ${cm.status}. Cannot redeem sessions.` };
        }

        if (isAfter(new Date(), parseISO(cm.expiryDate))) {
            cm.status = 'expired';
            await saveMemberships();
            return { success: false, message: 'Membership has expired on ' + new Date(cm.expiryDate).toLocaleDateString() };
        }

        const proc = cm.allowedProcedures.find(p => p.serviceId === serviceId);
        if (!proc) {
            return { success: false, message: 'This procedure is not covered under this membership tier.' };
        }

        if (proc.totalAllowed !== -1 && proc.remainingCount <= 0) {
            return { success: false, message: `All ${proc.totalAllowed} sessions for "${proc.serviceName}" have already been consumed.` };
        }

        // Decrement session if not unlimited
        if (proc.totalAllowed !== -1) {
            proc.remainingCount -= 1;
            proc.usedCount += 1;
        } else {
            proc.usedCount += 1;
        }

        // Record usage history
        const usageLog: ProcedureUsageRecord = {
            id: `usage-${Date.now()}`,
            date: new Date().toISOString(),
            serviceId: proc.serviceId,
            serviceName: proc.serviceName,
            doctorName: details.doctorName,
            clinicName: details.clinicName,
            recordedBy: details.recordedBy || 'Admin',
            notes: details.notes
        };

        cm.usageHistory = cm.usageHistory || [];
        cm.usageHistory.unshift(usageLog);

        await saveMemberships();

        return {
            success: true,
            message: `Redeemed 1 session of "${proc.serviceName}".`,
            remaining: proc.totalAllowed === -1 ? 'unlimited' : proc.remainingCount
        };
    },

    updateCustomerMembershipStatus: async (
        id: string,
        status: CustomerMembership['status'],
        staffName?: string
    ): Promise<boolean> => {
        await ensureMembershipsLoaded();
        const index = customerMemberships.findIndex(cm => cm.id === id);
        if (index === -1) return false;

        customerMemberships[index].status = status;
        if (status === 'cancelled') {
            customerMemberships[index].notes = (customerMemberships[index].notes ? customerMemberships[index].notes + ' | ' : '') + `Cancelled by ${staffName || 'Admin'} on ${new Date().toLocaleDateString()}`;
        }

        await saveMemberships();
        return true;
    },

    deleteCustomerMembership: async (id: string): Promise<boolean> => {
        await ensureMembershipsLoaded();
        const initialLength = customerMemberships.length;
        customerMemberships = customerMemberships.filter(cm => cm.id !== id);
        if (customerMemberships.length !== initialLength) {
            await saveMemberships();
            return true;
        }
        return false;
    },

    // ── Membership Privileges Catalog Management ──
    getPrivileges: async (includeInactive: boolean = false): Promise<MembershipPrivilegeDef[]> => {
        await ensureMembershipsLoaded();
        if (includeInactive) return privileges;
        return privileges.filter(p => p.active);
    },

    getPrivilegeById: async (id: string): Promise<MembershipPrivilegeDef | undefined> => {
        await ensureMembershipsLoaded();
        return privileges.find(p => p.id === id);
    },

    createPrivilege: async (data: Omit<MembershipPrivilegeDef, 'id' | 'createdAt' | 'updatedAt'>): Promise<MembershipPrivilegeDef> => {
        await ensureMembershipsLoaded();
        const newPrivilege: MembershipPrivilegeDef = {
            ...data,
            id: `priv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            active: data.active !== undefined ? data.active : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        privileges.push(newPrivilege);
        await saveMemberships();
        return newPrivilege;
    },

    updatePrivilege: async (id: string, updates: Partial<MembershipPrivilegeDef>): Promise<MembershipPrivilegeDef | null> => {
        await ensureMembershipsLoaded();
        const index = privileges.findIndex(p => p.id === id);
        if (index === -1) return null;

        privileges[index] = {
            ...privileges[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await saveMemberships();
        return privileges[index];
    },

    deletePrivilege: async (id: string): Promise<boolean> => {
        await ensureMembershipsLoaded();
        const initialLength = privileges.length;
        privileges = privileges.filter(p => p.id !== id);
        if (privileges.length !== initialLength) {
            await saveMemberships();
            return true;
        }
        return false;
    },

    togglePrivilege: async (id: string): Promise<MembershipPrivilegeDef | null> => {
        await ensureMembershipsLoaded();
        const index = privileges.findIndex(p => p.id === id);
        if (index === -1) return null;

        privileges[index].active = !privileges[index].active;
        privileges[index].updatedAt = new Date().toISOString();
        await saveMemberships();
        return privileges[index];
    }
};
