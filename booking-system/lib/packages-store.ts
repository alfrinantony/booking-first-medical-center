// ─────────────────────────────────────────────────────────────
// Packages Store — Package & Customer-Package CRUD with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { Package, CustomerPackage, ComplimentaryService } from '@/types/packages';
import { addDays, isAfter, parseISO } from 'date-fns';

// ── In-memory store ──
interface PackagesData {
    availablePackages: Package[];
    customerPackages: CustomerPackage[];
}

let availablePackages: Package[] = [];
let customerPackages: CustomerPackage[] = [];
let packagesLoaded = false;

async function ensurePackagesLoaded() {
    if (!packagesLoaded) {
        const data = await loadFromBlob<PackagesData>('packages', { availablePackages: [], customerPackages: [] });
        availablePackages = data.availablePackages;
        customerPackages = data.customerPackages;
        packagesLoaded = true;
    }
}

async function savePackages() {
    await saveToBlob<PackagesData>('packages', { availablePackages, customerPackages });
}

export const PackagesStore = {
    // ── Admin Actions ──
    createPackage: async (pkg: Omit<Package, 'id' | 'createdAt'>): Promise<Package> => {
        await ensurePackagesLoaded();
        const newPkg: Package = {
            ...pkg,
            id: `pkg-${Date.now()}`,
            createdAt: new Date().toISOString(),
        };
        availablePackages.push(newPkg);
        await savePackages();
        return newPkg;
    },

    updatePackage: async (id: string, updates: Partial<Package>) => {
        await ensurePackagesLoaded();
        const idx = availablePackages.findIndex(p => p.id === id);
        if (idx >= 0) {
            availablePackages[idx] = { ...availablePackages[idx], ...updates };
            await savePackages();
        }
    },

    deletePackage: async (id: string) => {
        await ensurePackagesLoaded();
        availablePackages = availablePackages.filter(p => p.id !== id);
        await savePackages();
    },

    getAvailablePackages: async (): Promise<Package[]> => {
        await ensurePackagesLoaded();
        return [...availablePackages];
    },

    getAllCustomerPackages: async (): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        return [...customerPackages];
    },

    // ── Client/Usage Actions ──
    purchasePackage: async (packageId: string, customerName: string, customerPhone: string): Promise<CustomerPackage | null> => {
        await ensurePackagesLoaded();
        const pkg = availablePackages.find(p => p.id === packageId);
        if (!pkg) return null;

        const purchaseDate = new Date();
        const expiryDate = addDays(purchaseDate, pkg.validityInDays);

        const remainingSessions: Record<string, number> = {};
        pkg.items.forEach(item => {
            remainingSessions[item.serviceId] = item.count;
        });

        const newCustomerPackage: CustomerPackage = {
            id: `cpkg-${Date.now()}`,
            packageId: pkg.id,
            packageName: pkg.name,
            customerName,
            customerPhone,
            purchaseDate: purchaseDate.toISOString(),
            expiryDate: expiryDate.toISOString(),
            remainingSessions,
            active: true,
            isCombo: (pkg as any).isCombo || false,
        };

        customerPackages.push(newCustomerPackage);
        await savePackages();
        return newCustomerPackage;
    },

    useSession: async (customerPackageId: string, serviceId: string): Promise<{ success: boolean; message: string; remaining?: number }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPackageId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const customerPkg = customerPackages[pkgIndex];
        if (!customerPkg.active) return { success: false, message: 'Package is inactive' };
        if (customerPkg.isFrozen) return { success: false, message: 'Package is currently frozen' };
        if (isAfter(new Date(), parseISO(customerPkg.expiryDate))) return { success: false, message: 'Package has expired' };

        const currentSessions = customerPkg.remainingSessions[serviceId] || 0;
        if (currentSessions <= 0) return { success: false, message: 'No sessions remaining for this service' };

        customerPackages[pkgIndex] = {
            ...customerPkg,
            remainingSessions: {
                ...customerPkg.remainingSessions,
                [serviceId]: currentSessions - 1,
            },
        };
        await savePackages();
        return { success: true, message: 'Session used successfully', remaining: currentSessions - 1 };
    },

    // ── Transfer ──
    transferPackage: async (customerPkgId: string, newOwnerName: string, newOwnerPhone: string, reason: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        if (pkg.isTransferred) return { success: false, message: 'This package has already been transferred once and cannot be transferred again.' };
        if (pkg.isFrozen) return { success: false, message: 'Frozen packages cannot be transferred.' };
        if (!pkg.active) return { success: false, message: 'Package is inactive.' };

        customerPackages[pkgIndex] = {
            ...pkg,
            transferredFrom: pkg.customerPhone,
            customerName: newOwnerName,
            customerPhone: newOwnerPhone,
            transferReason: reason,
            isTransferred: true,
        };
        await savePackages();
        return { success: true, message: `Package transferred to ${newOwnerName} (${newOwnerPhone})` };
    },

    // ── Freeze ──
    freezePackage: async (customerPkgId: string, reason: 'medical' | 'pregnancy_breastfeeding', documentName: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        if (pkg.hasBeenFrozen) return { success: false, message: 'This package has already been frozen once. Only one freeze per purchase is allowed.' };
        if (!pkg.active) return { success: false, message: 'Package is inactive.' };
        if (pkg.isFrozen) return { success: false, message: 'Package is already frozen.' };

        customerPackages[pkgIndex] = {
            ...pkg,
            isFrozen: true,
            frozenAt: new Date().toISOString(),
            freezeReason: reason,
            freezeDocumentName: documentName,
            hasBeenFrozen: true,
        };
        await savePackages();
        return { success: true, message: `Package frozen. Reason: ${reason === 'medical' ? 'Medical Condition' : 'Pregnancy/Breastfeeding'}` };
    },

    unfreezePackage: async (customerPkgId: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        if (!pkg.isFrozen) return { success: false, message: 'Package is not frozen.' };

        customerPackages[pkgIndex] = { ...pkg, isFrozen: false };
        await savePackages();
        return { success: true, message: 'Package unfrozen successfully.' };
    },

    // ── Partial Adjustment ──
    adjustPartialPackage: async (customerPkgId: string, sessionsUsed: number, singleSessionDiscountedPrice: number): Promise<{ success: boolean; message: string; remainingBalance?: number; usedAmount?: number }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        const parentPkg = availablePackages.find(p => p.id === pkg.packageId);
        if (!parentPkg) return { success: false, message: 'Original package definition not found' };

        const usedAmount = singleSessionDiscountedPrice * sessionsUsed;
        const remainingBalance = parentPkg.price - usedAmount;

        if (remainingBalance <= 0) {
            return { success: false, message: `No remaining balance. Used amount (AED ${usedAmount.toFixed(2)}) exceeds or equals package price (AED ${parentPkg.price.toFixed(2)}).` };
        }

        customerPackages[pkgIndex] = { ...pkg, active: false };
        await savePackages();

        return {
            success: true,
            message: `Package adjusted. Used: AED ${usedAmount.toFixed(2)} (${sessionsUsed} sessions × AED ${singleSessionDiscountedPrice.toFixed(2)}). Remaining balance: AED ${remainingBalance.toFixed(2)} can be applied to another service.`,
            remainingBalance,
            usedAmount,
        };
    },

    // ── Complimentary Services ──
    addComplimentaryService: async (customerPkgId: string, serviceId: string, serviceName: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        const existing = pkg.complimentaryServices || [];

        const newComplimentary: ComplimentaryService = { serviceId, serviceName, used: false };
        customerPackages[pkgIndex] = { ...pkg, complimentaryServices: [...existing, newComplimentary] };
        await savePackages();
        return { success: true, message: `Complimentary service "${serviceName}" added.` };
    },

    useComplimentaryService: async (customerPkgId: string, serviceIndex: number, recipientPhone?: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[pkgIndex];
        const services = [...(pkg.complimentaryServices || [])];
        if (serviceIndex < 0 || serviceIndex >= services.length) return { success: false, message: 'Invalid service index.' };
        if (services[serviceIndex].used) return { success: false, message: 'This complimentary service has already been used.' };

        services[serviceIndex] = { ...services[serviceIndex], used: true, recipientPhone: recipientPhone || undefined };
        customerPackages[pkgIndex] = { ...pkg, complimentaryServices: services };
        await savePackages();
        return { success: true, message: `Complimentary service "${services[serviceIndex].serviceName}" marked as used.` };
    },

    // ── Dynamic Pricing Calculation (stateless) ──
    calculateCustomSessionsPrice: (sessionTiers: { sessions: number; price: number }[], requestedSessions: number): { price: number; basedOn: string } => {
        const sorted = [...sessionTiers].sort((a, b) => b.sessions - a.sessions);
        const nearestLower = sorted.find(t => t.sessions <= requestedSessions);

        if (!nearestLower) {
            const single = sessionTiers.find(t => t.sessions === 1);
            const singlePrice = single ? single.price : sessionTiers[0]?.price || 0;
            return {
                price: singlePrice * requestedSessions,
                basedOn: `${requestedSessions} × single session price (AED ${singlePrice})`,
            };
        }

        const perSessionCost = nearestLower.price / nearestLower.sessions;
        const totalPrice = perSessionCost * requestedSessions;

        return {
            price: Math.round(totalPrice * 100) / 100,
            basedOn: `Based on ${nearestLower.sessions}-session package: AED ${nearestLower.price} ÷ ${nearestLower.sessions} sessions = AED ${perSessionCost.toFixed(2)}/session × ${requestedSessions} sessions`,
        };
    },

    // ── Getters ──
    getCustomerPackages: async (phone: string): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        return customerPackages.filter(p => p.customerPhone === phone);
    },

    getMyPackages: async (phone: string): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        const now = new Date();
        return customerPackages.filter(p =>
            p.customerPhone === phone &&
            p.active &&
            isAfter(parseISO(p.expiryDate), now)
        );
    },
};
