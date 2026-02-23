import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Package, CustomerPackage } from '@/types/packages';
import { addDays, format, isAfter, parseISO } from 'date-fns';

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
                    active: true
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

                // Check Validity
                if (!customerPkg.active) {
                    return { success: false, message: 'Package is inactive' };
                }

                if (isAfter(new Date(), parseISO(customerPkg.expiryDate))) {
                    return { success: false, message: 'Package has expired' };
                }

                // Check Sessions
                const currentSessions = customerPkg.remainingSessions[serviceId] || 0;
                if (currentSessions <= 0) {
                    return { success: false, message: 'No sessions remaining for this service' };
                }

                // Deduct Session
                const updatedPkg = {
                    ...customerPkg,
                    remainingSessions: {
                        ...customerPkg.remainingSessions,
                        [serviceId]: currentSessions - 1
                    }
                };

                // Update Store synchronously to ensure immediate UI reflection
                const newPackages = [...state.customerPackages];
                newPackages[pkgIndex] = updatedPkg;

                set({ customerPackages: newPackages });

                return {
                    success: true,
                    message: 'Session used successfully',
                    remaining: currentSessions - 1
                };
            },

            getCustomerPackages: (phone) => {
                return get().customerPackages.filter(p => p.customerPhone === phone);
            },

            getMyPackages: (phone) => {
                // Return active packages that are not expired
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
