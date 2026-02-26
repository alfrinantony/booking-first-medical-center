import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Package, CustomerPackage, ComplimentaryService } from '@/types/packages';
import { addDays, isAfter, parseISO } from 'date-fns';

interface PackagesState {
    availablePackages: Package[];
    customerPackages: CustomerPackage[];

    // Admin Actions
    createPackage: (pkg: Omit<Package, 'id' | 'createdAt'>) => void;
    updatePackage: (id: string, updates: Partial<Package>) => void;
    deletePackage: (id: string) => void;

    // Client/Usage Actions
    purchasePackage: (packageId: string, customerName: string, customerPhone: string) => CustomerPackage | null;
    useSession: (customerPackageId: string, serviceId: string) => { success: boolean; message: string; remaining?: number };

    // Transfer
    transferPackage: (customerPkgId: string, newOwnerName: string, newOwnerPhone: string, reason: string) => { success: boolean; message: string };

    // Freeze
    freezePackage: (customerPkgId: string, reason: 'medical' | 'pregnancy_breastfeeding', documentName: string) => { success: boolean; message: string };
    unfreezePackage: (customerPkgId: string) => { success: boolean; message: string };

    // Partial Adjustment
    adjustPartialPackage: (customerPkgId: string, sessionsUsed: number, singleSessionDiscountedPrice: number) => { success: boolean; message: string; remainingBalance?: number; usedAmount?: number };

    // Complimentary
    addComplimentaryService: (customerPkgId: string, serviceId: string, serviceName: string) => { success: boolean; message: string };
    useComplimentaryService: (customerPkgId: string, serviceIndex: number, recipientPhone?: string) => { success: boolean; message: string };

    // Pricing calculation
    calculateCustomSessionsPrice: (sessionTiers: { sessions: number; price: number }[], requestedSessions: number) => { price: number; basedOn: string };

    // Getters
    getCustomerPackages: (phone: string) => CustomerPackage[];
    getMyPackages: (phone: string) => CustomerPackage[];
}

export const usePackagesStore = create<PackagesState>()(
    persist(
        (set, get) => ({
            availablePackages: [],
            customerPackages: [],

            createPackage: (pkg) => set((state) => ({
                availablePackages: [
                    ...state.availablePackages,
                    {
                        ...pkg,
                        id: `pkg-${Date.now()}`,
                        createdAt: new Date().toISOString()
                    }
                ]
            })),

            updatePackage: (id, updates) => set((state) => ({
                availablePackages: state.availablePackages.map(p =>
                    p.id === id ? { ...p, ...updates } : p
                )
            })),

            deletePackage: (id) => set((state) => ({
                availablePackages: state.availablePackages.filter(p => p.id !== id)
            })),

            purchasePackage: (packageId, customerName, customerPhone) => {
                const pkg = get().availablePackages.find(p => p.id === packageId);
                if (!pkg) return null;

                const purchaseDate = new Date();
                const expiryDate = addDays(purchaseDate, pkg.validityInDays);

                // Initialize remaining sessions map
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

                set(state => ({
                    customerPackages: [...state.customerPackages, newCustomerPackage]
                }));

                return newCustomerPackage;
            },

            useSession: (customerPackageId, serviceId) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPackageId);

                if (pkgIndex === -1) {
                    return { success: false, message: 'Package not found' };
                }

                const customerPkg = state.customerPackages[pkgIndex];

                if (!customerPkg.active) {
                    return { success: false, message: 'Package is inactive' };
                }

                if (customerPkg.isFrozen) {
                    return { success: false, message: 'Package is currently frozen' };
                }

                if (isAfter(new Date(), parseISO(customerPkg.expiryDate))) {
                    return { success: false, message: 'Package has expired' };
                }

                const currentSessions = customerPkg.remainingSessions[serviceId] || 0;
                if (currentSessions <= 0) {
                    return { success: false, message: 'No sessions remaining for this service' };
                }

                const updatedPkg = {
                    ...customerPkg,
                    remainingSessions: {
                        ...customerPkg.remainingSessions,
                        [serviceId]: currentSessions - 1
                    }
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return {
                    success: true,
                    message: 'Session used successfully',
                    remaining: currentSessions - 1
                };
            },

            // ── Transfer ──
            transferPackage: (customerPkgId, newOwnerName, newOwnerPhone, reason) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];

                if (pkg.isTransferred) {
                    return { success: false, message: 'This package has already been transferred once and cannot be transferred again.' };
                }
                if (pkg.isFrozen) {
                    return { success: false, message: 'Frozen packages cannot be transferred.' };
                }
                if (!pkg.active) {
                    return { success: false, message: 'Package is inactive.' };
                }

                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    transferredFrom: pkg.customerPhone,
                    customerName: newOwnerName,
                    customerPhone: newOwnerPhone,
                    transferReason: reason,
                    isTransferred: true
                    // Original validity remains unchanged
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return { success: true, message: `Package transferred to ${newOwnerName} (${newOwnerPhone})` };
            },

            // ── Freeze ──
            freezePackage: (customerPkgId, reason, documentName) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];

                if (pkg.hasBeenFrozen) {
                    return { success: false, message: 'This package has already been frozen once. Only one freeze per purchase is allowed.' };
                }
                if (!pkg.active) {
                    return { success: false, message: 'Package is inactive.' };
                }
                if (pkg.isFrozen) {
                    return { success: false, message: 'Package is already frozen.' };
                }

                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    isFrozen: true,
                    frozenAt: new Date().toISOString(),
                    freezeReason: reason,
                    freezeDocumentName: documentName,
                    hasBeenFrozen: true
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return { success: true, message: `Package frozen. Reason: ${reason === 'medical' ? 'Medical Condition' : 'Pregnancy/Breastfeeding'}` };
            },

            unfreezePackage: (customerPkgId) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];
                if (!pkg.isFrozen) {
                    return { success: false, message: 'Package is not frozen.' };
                }

                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    isFrozen: false
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return { success: true, message: 'Package unfrozen successfully.' };
            },

            // ── Partial Adjustment ──
            adjustPartialPackage: (customerPkgId, sessionsUsed, singleSessionDiscountedPrice) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];
                const parentPkg = state.availablePackages.find(p => p.id === pkg.packageId);
                if (!parentPkg) return { success: false, message: 'Original package definition not found' };

                // Used amount = single-session discounted price × sessions used
                const usedAmount = singleSessionDiscountedPrice * sessionsUsed;
                const remainingBalance = parentPkg.price - usedAmount;

                if (remainingBalance <= 0) {
                    return { success: false, message: `No remaining balance. Used amount (AED ${usedAmount.toFixed(2)}) exceeds or equals package price (AED ${parentPkg.price.toFixed(2)}).` };
                }

                // Deactivate the package (balance is used for adjustment toward another service)
                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    active: false
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return {
                    success: true,
                    message: `Package adjusted. Used: AED ${usedAmount.toFixed(2)} (${sessionsUsed} sessions × AED ${singleSessionDiscountedPrice.toFixed(2)}). Remaining balance: AED ${remainingBalance.toFixed(2)} can be applied to another service.`,
                    remainingBalance,
                    usedAmount
                };
            },

            // ── Complimentary Services ──
            addComplimentaryService: (customerPkgId, serviceId, serviceName) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];
                const existing = pkg.complimentaryServices || [];

                const newComplimentary: ComplimentaryService = {
                    serviceId,
                    serviceName,
                    used: false
                };

                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    complimentaryServices: [...existing, newComplimentary]
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return { success: true, message: `Complimentary service "${serviceName}" added.` };
            },

            useComplimentaryService: (customerPkgId, serviceIndex, recipientPhone) => {
                const state = get();
                const pkgIndex = state.customerPackages.findIndex(p => p.id === customerPkgId);
                if (pkgIndex === -1) return { success: false, message: 'Package not found' };

                const pkg = state.customerPackages[pkgIndex];
                const services = [...(pkg.complimentaryServices || [])];

                if (serviceIndex < 0 || serviceIndex >= services.length) {
                    return { success: false, message: 'Invalid service index.' };
                }

                if (services[serviceIndex].used) {
                    return { success: false, message: 'This complimentary service has already been used.' };
                }

                services[serviceIndex] = {
                    ...services[serviceIndex],
                    used: true,
                    recipientPhone: recipientPhone || undefined
                };

                const updatedPkg: CustomerPackage = {
                    ...pkg,
                    complimentaryServices: services
                };

                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;
                set({ customerPackages: newPackages });

                return { success: true, message: `Complimentary service "${services[serviceIndex].serviceName}" marked as used.` };
            },

            // ── Dynamic Pricing Calculation ──
            calculateCustomSessionsPrice: (sessionTiers, requestedSessions) => {
                // sessionTiers: e.g. [{ sessions: 1, price: 499 }, { sessions: 3, price: 1200 }, { sessions: 6, price: 2100 }]
                // Sort tiers by sessions descending to find nearest lower
                const sorted = [...sessionTiers].sort((a, b) => b.sessions - a.sessions);

                // Find the nearest lower available package
                const nearestLower = sorted.find(t => t.sessions <= requestedSessions);

                if (!nearestLower) {
                    // Fall back to single session price
                    const single = sessionTiers.find(t => t.sessions === 1);
                    const singlePrice = single ? single.price : sessionTiers[0]?.price || 0;
                    return {
                        price: singlePrice * requestedSessions,
                        basedOn: `${requestedSessions} × single session price (AED ${singlePrice})`
                    };
                }

                const perSessionCost = nearestLower.price / nearestLower.sessions;
                const totalPrice = perSessionCost * requestedSessions;

                return {
                    price: Math.round(totalPrice * 100) / 100,
                    basedOn: `Based on ${nearestLower.sessions}-session package: AED ${nearestLower.price} ÷ ${nearestLower.sessions} sessions = AED ${perSessionCost.toFixed(2)}/session × ${requestedSessions} sessions`
                };
            },

            getCustomerPackages: (phone) => {
                return get().customerPackages.filter(p => p.customerPhone === phone);
            },

            getMyPackages: (phone) => {
                const now = new Date();
                return get().customerPackages.filter(p =>
                    p.customerPhone === phone &&
                    p.active &&
                    isAfter(parseISO(p.expiryDate), now)
                );
            }
        }),
        {
            name: 'packages-store'
        }
    )
);
