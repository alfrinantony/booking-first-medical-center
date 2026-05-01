// ─────────────────────────────────────────────────────────────
// Packages Store — Package & Customer-Package CRUD with Azure Blob persistence
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';
import { Package, CustomerPackage, ComplimentaryService, PackageTransferRequest, PackageExtensionRequest } from '@/types/packages';
import { addDays, isAfter, parseISO } from 'date-fns';

// ── In-memory store ──
interface PackagesData {
    availablePackages: Package[];
    customerPackages: CustomerPackage[];
    transferRequests?: PackageTransferRequest[];
    extensionRequests?: PackageExtensionRequest[];
}

let availablePackages: Package[] = [];
let customerPackages: CustomerPackage[] = [];
let transferRequests: PackageTransferRequest[] = [];
let extensionRequests: PackageExtensionRequest[] = [];
async function ensurePackagesLoaded() {
    
        const data = await loadFromBlob<PackagesData>('packages', { availablePackages: [], customerPackages: [], transferRequests: [], extensionRequests: [] });
        availablePackages = data.availablePackages || [];
        customerPackages = data.customerPackages || [];
        transferRequests = data.transferRequests || [];
        extensionRequests = data.extensionRequests || [];
        
}

async function savePackages() {
    await saveToBlob<PackagesData>('packages', { availablePackages, customerPackages, transferRequests, extensionRequests });
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

    deleteCustomerPackage: async (id: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const pkg = customerPackages.find(p => p.id === id);
        if (!pkg) return { success: false, message: 'Customer package not found' };
        customerPackages = customerPackages.filter(p => p.id !== id);
        await savePackages();
        return { success: true, message: `Package "${pkg.packageName}" for ${pkg.customerName} has been deleted.` };
    },

    cancelCustomerPackage: async (id: string, staffName: string): Promise<{ success: boolean; message: string; refundAmount?: number }> => {
        await ensurePackagesLoaded();
        const customerPkgIndex = customerPackages.findIndex(p => p.id === id);
        if (customerPkgIndex === -1) return { success: false, message: 'Customer package not found' };

        const customerPkg = customerPackages[customerPkgIndex];
        const pkgTemplate = availablePackages.find(p => p.id === customerPkg.packageId);
        
        if (!pkgTemplate) return { success: false, message: 'Original package template not found' };

        // Calculate refund
        let totalUsedValue = 0;
        
        // Try to load ServicesStore dynamically to get single session prices
        let getServiceById: any = null;
        try {
            const { ServicesStore } = await import('./services-store');
            getServiceById = ServicesStore.getServiceById;
        } catch (e) {
            console.warn("Could not load ServicesStore for package cancellation refund calc");
        }

        for (const item of pkgTemplate.items) {
            const total = item.count;
            const remaining = customerPkg.remainingSessions[item.serviceId] || 0;
            const used = total - remaining;
            
            if (used > 0) {
                let sessionPrice = pkgTemplate.price / pkgTemplate.items.reduce((acc, i) => acc + i.count, 0); // fallback average price
                if (getServiceById) {
                    const service = await getServiceById(item.serviceId);
                    if (service?.price) {
                        sessionPrice = service.price; // Use actual single session price
                    }
                }
                totalUsedValue += (used * sessionPrice);
            }
        }

        const refundAmount = Math.max(0, pkgTemplate.price - totalUsedValue);

        // Add to wallet
        try {
            const { WalletStore } = await import('./wallet-store');
            await WalletStore.addTransaction(
                customerPkg.customerPhone,
                customerPkg.customerName,
                refundAmount,
                'refund',
                `Refund for cancelled package: ${customerPkg.packageName}`,
                customerPkg.id,
                staffName
            );
        } catch (e) {
            console.error("Failed to add refund to wallet:", e);
            return { success: false, message: 'Failed to credit wallet' };
        }

        // Remove the package (or mark inactive)
        customerPackages = customerPackages.filter(p => p.id !== id);
        await savePackages();

        return { 
            success: true, 
            message: `Package cancelled. AED ${refundAmount.toFixed(2)} refunded to Wallet.`,
            refundAmount
        };
    },

    convertPackageToBalance: async (id: string, staffName: string): Promise<{ success: boolean; message: string; balanceAdded?: number }> => {
        await ensurePackagesLoaded();
        const customerPkgIndex = customerPackages.findIndex(p => p.id === id);
        if (customerPkgIndex === -1) return { success: false, message: 'Customer package not found' };

        const customerPkg = customerPackages[customerPkgIndex];
        const pkgTemplate = availablePackages.find(p => p.id === customerPkg.packageId);
        
        if (!pkgTemplate) return { success: false, message: 'Original package template not found' };

        const previouslyConsumed = customerPkg.consumedValue || 0;
        const remainingToConvert = Math.max(0, pkgTemplate.price - previouslyConsumed);

        if (remainingToConvert <= 0) {
            return { success: false, message: 'No remaining value left in this package to convert.' };
        }

        try {
            const { WalletStore } = await import('./wallet-store');
            await WalletStore.addRestrictedBalance(
                customerPkg.customerPhone,
                customerPkg.customerName,
                remainingToConvert,
                customerPkg.expiryDate,
                customerPkg.id,
                `Converted from Package: ${customerPkg.packageName}`,
                staffName
            );
        } catch (e) {
            console.error("Failed to add restricted refund to wallet:", e);
            return { success: false, message: 'Failed to credit restricted balance to wallet' };
        }

        // Complete the conversion by discarding the package
        customerPackages = customerPackages.filter(p => p.id !== id);
        await savePackages();

        return { 
            success: true, 
            message: `Package converted. AED ${remainingToConvert.toFixed(2)} added as Restricted Balance.`,
            balanceAdded: remainingToConvert
        };
    },

    getAvailablePackages: async (): Promise<Package[]> => {
        await ensurePackagesLoaded();
        return [...availablePackages];
    },

    getAllCustomerPackages: async (): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        return [...customerPackages];
    },

    importSimplyBookPackages: async (incoming: CustomerPackage[]): Promise<{ added: number; skipped: number }> => {
        await ensurePackagesLoaded();
        let added = 0;
        let skipped = 0;
        
        for (const pkg of incoming) {
            if (customerPackages.find(p => p.id === pkg.id)) {
                skipped++;
            } else {
                customerPackages.push(pkg);
                added++;
            }
        }
        
        if (added > 0) {
            await savePackages();
        }
        return { added, skipped };
    },

    // ── Client/Usage Actions ──
    purchasePackage: async (packageId: string, customerName: string, customerPhone: string, paymentMethod: 'pay_at_clinic' | 'credit_card' = 'credit_card'): Promise<CustomerPackage | null> => {
        await ensurePackagesLoaded();
        const pkg = availablePackages.find(p => p.id === packageId);
        if (!pkg) return null;

        const purchaseDate = new Date();
        const expiryDate = addDays(purchaseDate, pkg.validityInDays);

        const remainingSessions: Record<string, number> = {};
        const totalSessions: Record<string, number> = {};
        pkg.items.forEach(item => {
            remainingSessions[item.serviceId] = item.count;
            totalSessions[item.serviceId] = item.count;
        });

        const isCardPayment = paymentMethod === 'credit_card';

        const newCustomerPackage: CustomerPackage = {
            id: `cpkg-${Date.now()}`,
            packageId: pkg.id,
            packageName: pkg.name,
            customerName,
            customerPhone,
            purchaseDate: purchaseDate.toISOString(),
            expiryDate: expiryDate.toISOString(),
            remainingSessions,
            totalSessions,
            active: isCardPayment, // Only active if paid by card
            paymentMethod,
            paymentStatus: isCardPayment ? 'paid' : 'pending',
            isCombo: (pkg as any).isCombo || false,
        };

        customerPackages.push(newCustomerPackage);
        await savePackages();
        return newCustomerPackage;
    },

    confirmPayment: async (customerPackageId: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const idx = customerPackages.findIndex(p => p.id === customerPackageId);
        if (idx === -1) return { success: false, message: 'Package not found' };

        const pkg = customerPackages[idx];
        if (pkg.paymentStatus === 'paid') return { success: false, message: 'Payment already confirmed' };

        customerPackages[idx] = {
            ...pkg,
            active: true,
            paymentStatus: 'paid',
        };
        await savePackages();
        return { success: true, message: 'Payment confirmed. Package is now active.' };
    },


    useSession: async (customerPackageId: string, serviceId: string): Promise<{ success: boolean; message: string; remaining?: number; deductedValue?: number }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPackageId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const customerPkg = customerPackages[pkgIndex];
        if (!customerPkg.active) return { success: false, message: 'Package is inactive' };
        if (customerPkg.isFrozen) return { success: false, message: 'Package is currently frozen' };
        if (isAfter(new Date(), parseISO(customerPkg.expiryDate))) return { success: false, message: 'Package has expired' };

        const currentSessions = customerPkg.remainingSessions[serviceId] || 0;
        if (currentSessions <= 0) return { success: false, message: 'No sessions remaining for this service' };

        // Calculate logical deducted value for this specific session
        let deductedValue = 0;
        const pkgTemplate = availablePackages.find(p => p.id === customerPkg.packageId);
        
        if (pkgTemplate) {
            const totalSessionsAcrossAllServices = Object.values(customerPkg.totalSessions).reduce((sum, n) => sum + n, 0);
            const sessionsRemainingAcrossAllServices = Object.values(customerPkg.remainingSessions).reduce((sum, n) => sum + n, 0);
            const previouslyConsumed = customerPkg.consumedValue || 0;

            if (totalSessionsAcrossAllServices > 0) {
                // E.g. 1000 / 3 = 333.333... -> 333.33
                const standardSessionValue = Math.floor((pkgTemplate.price / totalSessionsAcrossAllServices) * 100) / 100;
                
                if (sessionsRemainingAcrossAllServices === 1) {
                    // This is the absolute LAST session! Apply the remainder so they perfectly add up to the package price
                    deductedValue = Math.max(0, pkgTemplate.price - previouslyConsumed);
                } else {
                    deductedValue = standardSessionValue;
                }
            }
        }
        
        // Ensure rounding to 2 decimals
        deductedValue = Math.round(deductedValue * 100) / 100;

        customerPackages[pkgIndex] = {
            ...customerPkg,
            remainingSessions: {
                ...customerPkg.remainingSessions,
                [serviceId]: currentSessions - 1,
            },
            consumedValue: (customerPkg.consumedValue || 0) + deductedValue,
        };
        await savePackages();
        return { success: true, message: 'Session used successfully', remaining: currentSessions - 1, deductedValue };
    },

    upgradeCustomerPackage: async (customerPkgId: string, newPackageId: string, staffName: string): Promise<{ success: boolean; message: string; upgradeCost?: number; oldPackageName?: string; newPackageName?: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const customerPkg = customerPackages[pkgIndex];
        const oldPkgTemplate = availablePackages.find(p => p.id === customerPkg.packageId);
        const newPkgTemplate = availablePackages.find(p => p.id === newPackageId);

        if (!oldPkgTemplate || !newPkgTemplate) return { success: false, message: 'Package templates not found' };
        if (!customerPkg.active) return { success: false, message: 'Cannot upgrade an inactive package' };

        const upgradeCost = newPkgTemplate.price - oldPkgTemplate.price;
        if (upgradeCost <= 0) return { success: false, message: 'Cannot upgrade to a package with an equal or lower base price' };

        // Verify it's the exact same service
        const oldServiceId = oldPkgTemplate.items[0]?.serviceId;
        const newServiceId = newPkgTemplate.items[0]?.serviceId;
        if (oldServiceId !== newServiceId) return { success: false, message: 'Upgrades must be for the exact same service. Use "Change Package" instead.' };

        // Calculate new sessions: New Total - Old Used
        const newTotalSessions: Record<string, number> = {};
        const newRemainingSessions: Record<string, number> = {};

        newPkgTemplate.items.forEach(item => {
            const oldTotal = customerPkg.totalSessions[item.serviceId] || 0;
            const oldRemaining = customerPkg.remainingSessions[item.serviceId] || 0;
            const oldUsed = oldTotal - oldRemaining;

            newTotalSessions[item.serviceId] = item.count;
            newRemainingSessions[item.serviceId] = Math.max(0, item.count - oldUsed);
        });

        customerPackages[pkgIndex] = {
            ...customerPkg,
            packageId: newPackageId,
            packageName: newPkgTemplate.name,
            totalSessions: newTotalSessions,
            remainingSessions: newRemainingSessions,
            expiryDate: addDays(new Date(), newPkgTemplate.validityInDays).toISOString()
        };

        await savePackages();

        return {
            success: true,
            message: `Successfully upgraded to ${newPkgTemplate.name}.`,
            upgradeCost,
            oldPackageName: oldPkgTemplate.name,
            newPackageName: newPkgTemplate.name
        };
    },

    changeCustomerPackage: async (customerPkgId: string, newPackageId: string, staffName: string): Promise<{ success: boolean; message: string; costDifference?: number; remainingValue?: number; oldPackageName?: string; newPackageName?: string }> => {
        await ensurePackagesLoaded();
        const pkgIndex = customerPackages.findIndex(p => p.id === customerPkgId);
        if (pkgIndex === -1) return { success: false, message: 'Package not found' };

        const customerPkg = customerPackages[pkgIndex];
        const oldPkgTemplate = availablePackages.find(p => p.id === customerPkg.packageId);
        const newPkgTemplate = availablePackages.find(p => p.id === newPackageId);

        if (!oldPkgTemplate || !newPkgTemplate) return { success: false, message: 'Package templates not found' };
        if (!customerPkg.active) return { success: false, message: 'Cannot change an inactive package' };

        // Calculate remaining value
        let totalUsedValue = 0;
        let getServiceById: any = null;
        try {
            const { ServicesStore } = await import('./services-store');
            getServiceById = ServicesStore.getServiceById;
        } catch (e) {
            console.warn("Could not load ServicesStore for package change refund calc");
        }

        for (const item of oldPkgTemplate.items) {
            const total = item.count;
            const remaining = customerPkg.remainingSessions[item.serviceId] || 0;
            const used = total - remaining;
            
            if (used > 0) {
                let sessionPrice = oldPkgTemplate.price / oldPkgTemplate.items.reduce((acc, i) => acc + i.count, 0); // fallback average price
                if (getServiceById) {
                    const service = await getServiceById(item.serviceId);
                    if (service?.price) {
                        sessionPrice = service.price;
                    }
                }
                totalUsedValue += (used * sessionPrice);
            }
        }

        const remainingValue = Math.max(0, oldPkgTemplate.price - totalUsedValue);
        const costDifference = newPkgTemplate.price - remainingValue;

        // If costDifference < 0 (credit), add to wallet. 
        if (costDifference < 0) {
            const creditAmount = Math.abs(costDifference);
            try {
                const { WalletStore } = await import('./wallet-store');
                await WalletStore.addRestrictedBalance(
                    customerPkg.customerPhone,
                    customerPkg.customerName,
                    creditAmount,
                    addDays(new Date(), newPkgTemplate.validityInDays).toISOString(),
                    customerPkg.id,
                    `Credit from changing package: ${customerPkg.packageName} to ${newPkgTemplate.name}`,
                    staffName
                );
            } catch (e) {
                console.error("Failed to add restricted refund to wallet:", e);
                return { success: false, message: 'Failed to credit restricted balance to wallet' };
            }
        }

        // Setup the new sessions fresh
        const newTotalSessions: Record<string, number> = {};
        const newRemainingSessions: Record<string, number> = {};

        newPkgTemplate.items.forEach(item => {
            newTotalSessions[item.serviceId] = item.count;
            newRemainingSessions[item.serviceId] = item.count;
        });

        // Mutate package
        customerPackages[pkgIndex] = {
            ...customerPkg,
            packageId: newPackageId,
            packageName: newPkgTemplate.name,
            totalSessions: newTotalSessions,
            remainingSessions: newRemainingSessions,
            consumedValue: 0, // Reset
            expiryDate: addDays(new Date(), newPkgTemplate.validityInDays).toISOString(),
            isCombo: (newPkgTemplate as any).isCombo || false,
        };

        await savePackages();

        return {
            success: true,
            message: `Successfully changed to ${newPkgTemplate.name}.`,
            costDifference,
            remainingValue,
            oldPackageName: oldPkgTemplate.name,
            newPackageName: newPkgTemplate.name
        };
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

    // ── Package Transfer Actions ──
    createTransferRequest: async (
        customerPackageId: string,
        fromCustomerPhone: string,
        fromCustomerName: string,
        toCustomerPhone: string,
        toCustomerName: string,
        reason: string
    ): Promise<{ success: boolean; message: string; request?: PackageTransferRequest }> => {
        await ensurePackagesLoaded();
        const pkg = customerPackages.find(p => p.id === customerPackageId);
        if (!pkg) return { success: false, message: 'Package not found' };
        if (pkg.customerPhone !== fromCustomerPhone) return { success: false, message: 'Unauthorized' };
        if (pkg.isTransferred) return { success: false, message: 'This package has already been transferred before.' };
        // Check if any session has been used
        const totalUsed = Object.keys(pkg.totalSessions).reduce((sum, key) => {
            return sum + (pkg.totalSessions[key] - (pkg.remainingSessions[key] || 0));
        }, 0);
        if (totalUsed > 0) return { success: false, message: 'Packages cannot be transferred once a session has been used.' };

        // Check if a pending transfer already exists
        const existing = transferRequests.find(r => r.customerPackageId === customerPackageId && r.status === 'pending');
        if (existing) return { success: false, message: 'A transfer request is already pending for this package.' };

        const newRequest: PackageTransferRequest = {
            id: `ptr-${Date.now()}`,
            customerPackageId,
            packageName: pkg.packageName,
            fromCustomerPhone,
            fromCustomerName,
            toCustomerPhone,
            toCustomerName,
            reason,
            status: 'pending',
            requestedAt: new Date().toISOString(),
        };

        transferRequests.push(newRequest);
        await savePackages();
        return { success: true, message: 'Transfer request submitted', request: newRequest };
    },

    getTransferRequests: async (status?: 'pending' | 'approved' | 'rejected'): Promise<PackageTransferRequest[]> => {
        await ensurePackagesLoaded();
        if (status) return transferRequests.filter(r => r.status === status);
        return [...transferRequests];
    },

    resolveTransferRequest: async (requestId: string, status: 'approved' | 'rejected', adminName: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const req = transferRequests.find(r => r.id === requestId);
        if (!req) return { success: false, message: 'Request not found' };
        if (req.status !== 'pending') return { success: false, message: 'Request is already resolved' };

        req.status = status;
        req.processedAt = new Date().toISOString();
        req.processedBy = adminName;

        if (status === 'approved') {
            const pkg = customerPackages.find(p => p.id === req.customerPackageId);
            if (!pkg) {
                req.status = 'rejected';
                await savePackages();
                return { success: false, message: 'Associated package not found' };
            }

            pkg.transferredFrom = pkg.customerPhone;
            pkg.customerPhone = req.toCustomerPhone;
            pkg.customerName = req.toCustomerName;
            pkg.transferReason = req.reason;
            pkg.isTransferred = true;
        }

        await savePackages();
        return { success: true, message: `Transfer ${status}` };
    },

    // ── Package Extension Actions ──
    createExtensionRequest: async (
        customerPackageId: string,
        customerPhone: string,
        customerName: string,
        reason: 'medical' | 'pregnancy_breastfeeding',
        documentUrl: string,
        requestedDays: number
    ): Promise<{ success: boolean; message: string; request?: PackageExtensionRequest }> => {
        await ensurePackagesLoaded();
        const pkg = customerPackages.find(p => p.id === customerPackageId);
        if (!pkg) return { success: false, message: 'Package not found' };
        if (pkg.customerPhone !== customerPhone) return { success: false, message: 'Unauthorized' };
        if (pkg.hasBeenFrozen) return { success: false, message: 'Package has already been extended/frozen once.' };

        const existing = extensionRequests.find(r => r.customerPackageId === customerPackageId && r.status === 'pending');
        if (existing) return { success: false, message: 'An extension request is already pending.' };

        const newRequest: PackageExtensionRequest = {
            id: `pex-${Date.now()}`,
            customerPackageId,
            packageName: pkg.packageName,
            customerPhone,
            customerName,
            reason,
            documentUrl,
            requestedDays,
            status: 'pending',
            requestedAt: new Date().toISOString(),
        };

        extensionRequests.push(newRequest);
        await savePackages();
        return { success: true, message: 'Extension request submitted', request: newRequest };
    },

    getExtensionRequests: async (status?: 'pending' | 'approved' | 'rejected'): Promise<PackageExtensionRequest[]> => {
        await ensurePackagesLoaded();
        if (status) return extensionRequests.filter(r => r.status === status);
        return [...extensionRequests];
    },

    resolveExtensionRequest: async (requestId: string, status: 'approved' | 'rejected', adminName: string): Promise<{ success: boolean; message: string }> => {
        await ensurePackagesLoaded();
        const req = extensionRequests.find(r => r.id === requestId);
        if (!req) return { success: false, message: 'Request not found' };
        if (req.status !== 'pending') return { success: false, message: 'Request is already resolved' };

        req.status = status;
        req.processedAt = new Date().toISOString();
        req.processedBy = adminName;

        if (status === 'approved') {
            const pkg = customerPackages.find(p => p.id === req.customerPackageId);
            if (!pkg) {
                req.status = 'rejected';
                await savePackages();
                return { success: false, message: 'Associated package not found' };
            }

            // Extend expiry date
            const currentExpiry = new Date(pkg.expiryDate);
            const newExpiry = addDays(currentExpiry, req.requestedDays);
            pkg.expiryDate = newExpiry.toISOString();
            
            pkg.isFrozen = true;
            pkg.frozenAt = new Date().toISOString();
            pkg.freezeReason = req.reason;
            pkg.freezeDocumentName = req.documentUrl; // Store the original reference
            pkg.hasBeenFrozen = true;
        }

        await savePackages();
        return { success: true, message: `Extension ${status}` };
    },

    // ── Getters ──
    getCustomerPackages: async (phone: string): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        const normalizePhone = (p: string) => {
            if (!p) return '';
            let clean = p.replace(/\D/g, '');
            if (clean.startsWith('00971')) clean = clean.substring(2);
            if (clean.startsWith('05')) clean = '971' + clean.substring(1);
            if (clean.startsWith('97105')) clean = '971' + clean.substring(4);
            return clean;
        };
        const normPhone = normalizePhone(phone);
        return customerPackages.filter(p => normalizePhone(p.customerPhone) === normPhone);
    },

    getMyPackages: async (phone: string): Promise<CustomerPackage[]> => {
        await ensurePackagesLoaded();
        const now = new Date();
        const normalizePhone = (p: string) => {
            if (!p) return '';
            let clean = p.replace(/\D/g, '');
            if (clean.startsWith('00971')) clean = clean.substring(2);
            if (clean.startsWith('05')) clean = '971' + clean.substring(1);
            if (clean.startsWith('97105')) clean = '971' + clean.substring(4);
            return clean;
        };
        const normPhone = normalizePhone(phone);
        return customerPackages.filter(p =>
            normalizePhone(p.customerPhone) === normPhone &&
            p.active &&
            isAfter(parseISO(p.expiryDate), now)
        );
    },
};
