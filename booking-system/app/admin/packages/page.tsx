'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, PackageServiceItem, CustomerPackage } from '@/types/packages';
import { Plus, Trash2, Package as PackageIcon, X, Search, User, Calendar, Receipt, CreditCard, Banknote, CheckCircle2 } from 'lucide-react';

// ── Safe helpers ──
function safeArray<T>(val: unknown): T[] {
    return Array.isArray(val) ? val : [];
}

interface ServiceOption {
    id: string;
    name: string;
    deptName: string;
    clinicName: string;
}

function extractServices(clinics: any[]): ServiceOption[] {
    const result: ServiceOption[] = [];
    const seen = new Set<string>();
    if (!Array.isArray(clinics)) return result;
    for (const clinic of clinics) {
        if (!clinic || typeof clinic !== 'object') continue;
        const depts = Array.isArray(clinic.departments) ? clinic.departments : [];
        for (const dept of depts) {
            if (!dept || typeof dept !== 'object') continue;
            const svcs = Array.isArray(dept.services) ? dept.services : [];
            for (const svc of svcs) {
                if (!svc || typeof svc !== 'object' || !svc.id) continue;
                const key = (svc.name || '').toLowerCase().trim();
                if (seen.has(key)) continue;
                seen.add(key);
                result.push({
                    id: svc.id,
                    name: svc.name || 'Unnamed',
                    deptName: dept.name || '',
                    clinicName: clinic.name || '',
                });
            }
        }
    }
    return result;
}

// ──────────────────────────────────────────────
// Error Boundary
// ──────────────────────────────────────────────
class PackagesErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-2xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                            The Packages page encountered an error. Please try refreshing.
                        </p>
                        <pre className="text-xs bg-red-100 dark:bg-red-900/40 p-3 rounded overflow-auto max-h-32 text-red-800 dark:text-red-300">
                            {this.state.error?.message}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ──────────────────────────────────────────────
// Main Page Export
// ──────────────────────────────────────────────
export default function PackagesPage() {
    return (
        <PackagesErrorBoundary>
            <PackagesContent />
        </PackagesErrorBoundary>
    );
}

// ──────────────────────────────────────────────
// Page Content
// ──────────────────────────────────────────────
function PackagesContent() {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'manage' | 'customers' | 'transfers' | 'extensions'>('manage');

    // Data
    const [packages, setPackages] = useState<Package[]>([]);
    const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);

    // Requests
    const [transferRequests, setTransferRequests] = useState<any[]>([]);
    const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Create form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formPrice, setFormPrice] = useState(0);
    const [formValidity, setFormValidity] = useState(30);
    const [formItems, setFormItems] = useState<PackageServiceItem[]>([]);
    const [selectedService, setSelectedService] = useState('');
    const [sessionCount, setSessionCount] = useState(1);

    // Customer tab
    const [customerPhoneSearch, setCustomerPhoneSearch] = useState('');
    const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
    const [assignPkgId, setAssignPkgId] = useState('');
    const [custName, setCustName] = useState('');
    const [custPhone, setCustPhone] = useState('');
    const [custEmail, setCustEmail] = useState('');
    const [billPaymentMethod, setBillPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('card');
    const [billPaymentConfirmed, setBillPaymentConfirmed] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [confirmingCustDeleteId, setConfirmingCustDeleteId] = useState<string | null>(null);
    const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
    const [assignSuccess, setAssignSuccess] = useState('');

    // Upgrade/Change
    const [upgradeModalPkg, setUpgradeModalPkg] = useState<CustomerPackage | null>(null);
    const [changeModalPkg, setChangeModalPkg] = useState<CustomerPackage | null>(null);
    const [selectedUpgradePkgId, setSelectedUpgradePkgId] = useState('');
    const [selectedChangePkgId, setSelectedChangePkgId] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isChanging, setIsChanging] = useState(false);

    // ── Fetch available packages ──
    const fetchPackages = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/packages');
            const data = await res.json();
            setPackages(safeArray<Package>(data));
        } catch {
            setPackages([]);
        }
    }, []);

    // ── Fetch Transfer Requests ──
    const fetchTransferRequests = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/packages/transfers');
            const data = await res.json();
            setTransferRequests(safeArray(data));
        } catch {
            setTransferRequests([]);
        }
    }, []);

    // ── Fetch Extension Requests ──
    const fetchExtensionRequests = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/packages/extensions');
            const data = await res.json();
            setExtensionRequests(safeArray(data));
        } catch {
            setExtensionRequests([]);
        }
    }, []);

    // ── Fetch services list from doctors API ──
    const fetchServices = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/doctors');
            const data = await res.json();
            setServiceOptions(extractServices(safeArray(data)));
        } catch {
            setServiceOptions([]);
        }
    }, []);

    // ── Fetch customer packages ──
    const fetchCustomerPackages = useCallback(async (phone: string) => {
        if (!phone) {
            setCustomerPackages([]);
            return;
        }
        try {
            const res = await fetch(`/api/admin/packages?type=customer&phone=${encodeURIComponent(phone)}`);
            const data = await res.json();
            setCustomerPackages(safeArray<CustomerPackage>(data));
        } catch {
            setCustomerPackages([]);
        }
    }, []);

    // ── Init ──
    useEffect(() => {
        setMounted(true);
        fetchPackages();
        fetchServices();
        fetchTransferRequests();
        fetchExtensionRequests();
    }, [fetchPackages, fetchServices, fetchTransferRequests, fetchExtensionRequests]);

    // ── Search customer packages on phone change ──
    useEffect(() => {
        fetchCustomerPackages(customerPhoneSearch);
    }, [customerPhoneSearch, fetchCustomerPackages]);

    // ── Handlers ──
    const handleResolveTransfer = async (requestId: string, status: 'approved' | 'rejected') => {
        setResolvingId(requestId);
        try {
            const stored = sessionStorage.getItem('adminUser');
            const adminName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
            await fetch('/api/admin/packages/transfers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, status, adminName })
            });
            fetchTransferRequests();
        } finally {
            setResolvingId(null);
        }
    };

    const handleResolveExtension = async (requestId: string, status: 'approved' | 'rejected') => {
        setResolvingId(requestId);
        try {
            const stored = sessionStorage.getItem('adminUser');
            const adminName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
            await fetch('/api/admin/packages/extensions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, status, adminName })
            });
            fetchExtensionRequests();
        } finally {
            setResolvingId(null);
        }
    };

    const handleAddItem = () => {
        if (!selectedService) return;
        const svc = serviceOptions.find(s => s.id === selectedService);
        if (!svc) return;

        setFormItems(prev => [
            ...prev,
            { serviceId: svc.id, serviceName: svc.name, count: Number(sessionCount) || 1 },
        ]);
        setSelectedService('');
        setSessionCount(1);
    };

    const handleRemoveItem = (idx: number) => {
        setFormItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleCreatePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formItems.length === 0) return;
        try {
            await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    data: {
                        name: formName,
                        description: formDesc,
                        price: formPrice,
                        validityInDays: formValidity,
                        items: formItems,
                        active: true,
                    },
                }),
            });
            setShowCreateForm(false);
            setFormName('');
            setFormDesc('');
            setFormPrice(0);
            setFormValidity(30);
            setFormItems([]);
            fetchPackages();
        } catch (err) {
            console.error('Create package failed:', err);
        }
    };

    const handleDeletePackage = async (id: string) => {
        try {
            await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id }),
            });
            setConfirmingDeleteId(null);
            fetchPackages();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleAssignPackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignPkgId || !custName || !custPhone) return;
        setIsAssigning(true);
        try {
            // 1. Assign the package to the customer
            const assignRes = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'purchase',
                    packageId: assignPkgId,
                    customerName: custName,
                    customerPhone: custPhone,
                }),
            });

            // If payment confirmed via card/online, also confirm the package payment
            if (billPaymentConfirmed && assignRes.ok) {
                const assignData = await assignRes.json();
                const customerPkgId = assignData?.id;
                if (customerPkgId) {
                    await fetch('/api/admin/packages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'confirmPayment', customerPackageId: customerPkgId }),
                    });
                }
            }

            // 2. Generate an invoice for the package
            const selectedPkg = packages.find(p => p.id === assignPkgId);
            if (selectedPkg) {
                const stored = sessionStorage.getItem('adminUser');
                const generatedBy = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
                const itemDescriptions = safeArray<PackageServiceItem>(selectedPkg.items)
                    .map(i => `${i.serviceName} (x${i.count})`).join(', ');

                await fetch('/api/admin/billing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        invoiceCategory: 'clinic_package',
                        clientName: custName,
                        clientPhone: custPhone,
                        clientEmail: custEmail || undefined,
                        items: [{
                            description: `Package: ${selectedPkg.name} — ${itemDescriptions}`,
                            quantity: 1,
                            unitPrice: selectedPkg.price,
                            total: selectedPkg.price,
                        }],
                        packageDetails: selectedPkg.name,
                        subtotal: selectedPkg.price,
                        taxPercentage: 0,
                        taxAmount: 0,
                        totalAmount: selectedPkg.price,
                        paymentMethod: billPaymentMethod,
                        paymentConfirmed: billPaymentConfirmed,
                        paymentReceivedBy: generatedBy,
                        paymentReceptionStatus: billPaymentConfirmed ? 'received' : 'pending',
                        generatedBy,
                        date: new Date().toISOString().split('T')[0],
                        notes: `Package assignment — ${selectedPkg.name} — Validity: ${selectedPkg.validityInDays} days`,
                    }),
                });
            }

            setAssignSuccess(`Package "${selectedPkg?.name}" assigned & billed to ${custName}`);
            setTimeout(() => setAssignSuccess(''), 4000);
            setAssignPkgId('');
            setCustName('');
            setCustPhone('');
            setCustEmail('');
            setCustomerPhoneSearch(custPhone);
        } catch (err) {
            console.error('Assign failed:', err);
            alert('Failed to assign package. Please try again.');
        }
        setIsAssigning(false);
    };

    const handleCancelCustomerPackage = async (customerPkgId: string) => {
        try {
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancelCustomerPackage', customerPackageId: customerPkgId }),
            });
            const result = await res.json();
            if (result.success) {
                setConfirmingCancelId(null);
                fetchCustomerPackages(customerPhoneSearch);
                alert(result.message);
            } else {
                alert(result.message || 'Failed to cancel package');
            }
        } catch (err) {
            console.error('Cancel customer package failed:', err);
        }
    };

    const handleDeleteCustomerPackage = async (customerPkgId: string) => {
        try {
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteCustomerPackage', customerPackageId: customerPkgId }),
            });
            const result = await res.json();
            if (result.success) {
                setConfirmingCustDeleteId(null);
                fetchCustomerPackages(customerPhoneSearch);
            } else {
                alert(result.message || 'Failed to delete');
            }
        } catch (err) {
            console.error('Delete customer package failed:', err);
        }
    };

    const handleUseSession = async (customerPkgId: string, serviceId: string) => {
        try {
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'useSession', customerPackageId: customerPkgId, serviceId }),
            });
            const result = await res.json();
            if (result.success) {
                alert(`Session used! Remaining: ${result.remaining}`);
                fetchCustomerPackages(customerPhoneSearch);
            } else {
                alert(`Error: ${result.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Use session failed:', err);
        }
    };

    const handleUpgradePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!upgradeModalPkg || !selectedUpgradePkgId) return;
        setIsUpgrading(true);
        try {
            const stored = sessionStorage.getItem('adminUser');
            const adminName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
            
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'upgradeCustomerPackage', customerPackageId: upgradeModalPkg.id, newPackageId: selectedUpgradePkgId, staffName: adminName })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.upgradeCost > 0) {
                     await fetch('/api/admin/billing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            invoiceCategory: 'package_upgrade',
                            clientName: upgradeModalPkg.customerName,
                            clientPhone: upgradeModalPkg.customerPhone,
                            items: [{
                                description: `Package Upgrade: ${data.oldPackageName} to ${data.newPackageName}`,
                                quantity: 1,
                                unitPrice: data.upgradeCost,
                                total: data.upgradeCost,
                            }],
                            subtotal: data.upgradeCost,
                            taxPercentage: 0,
                            taxAmount: 0,
                            totalAmount: data.upgradeCost,
                            paymentMethod: billPaymentMethod,
                            paymentConfirmed: billPaymentConfirmed,
                            paymentReceivedBy: adminName,
                            paymentReceptionStatus: billPaymentConfirmed ? 'received' : 'pending',
                            generatedBy: adminName,
                            date: new Date().toISOString().split('T')[0],
                            notes: `Package upgrade.`,
                        }),
                    });
                }
                alert(`Successfully upgraded! Invoice created for AED ${data.upgradeCost}`);
                setUpgradeModalPkg(null);
                setSelectedUpgradePkgId('');
                fetchCustomerPackages(customerPhoneSearch);
            } else {
                alert(data.message || 'Error occurred');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to upgrade');
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleChangePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!changeModalPkg || !selectedChangePkgId) return;
        setIsChanging(true);
        try {
            const stored = sessionStorage.getItem('adminUser');
            const adminName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
            
            const res = await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'changeCustomerPackage', customerPackageId: changeModalPkg.id, newPackageId: selectedChangePkgId, staffName: adminName })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.costDifference > 0) {
                     await fetch('/api/admin/billing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            invoiceCategory: 'package_change',
                            clientName: changeModalPkg.customerName,
                            clientPhone: changeModalPkg.customerPhone,
                            items: [{
                                description: `Package Change: ${data.oldPackageName} to ${data.newPackageName}`,
                                quantity: 1,
                                unitPrice: data.costDifference,
                                total: data.costDifference,
                            }],
                            subtotal: data.costDifference,
                            taxPercentage: 0,
                            taxAmount: 0,
                            totalAmount: data.costDifference,
                            paymentMethod: billPaymentMethod,
                            paymentConfirmed: billPaymentConfirmed,
                            paymentReceivedBy: adminName,
                            paymentReceptionStatus: billPaymentConfirmed ? 'received' : 'pending',
                            generatedBy: adminName,
                            date: new Date().toISOString().split('T')[0],
                            notes: `Credited unused value of AED ${data.remainingValue}.`,
                        }),
                    });
                     alert(`Successfully changed! Collect AED ${data.costDifference}`);
                } else if (data.costDifference < 0) {
                     alert(`Successfully changed! AED ${Math.abs(data.costDifference)} credited to wallet.`);
                } else {
                     alert(`Successfully changed! No cost difference.`);
                }
                setChangeModalPkg(null);
                setSelectedChangePkgId('');
                fetchCustomerPackages(customerPhoneSearch);
            } else {
                alert(data.message || 'Error occurred');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to change package');
        } finally {
            setIsChanging(false);
        }
    };

    // ── Loading ──
    if (!mounted) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-gray-500">Loading packages...</span>
            </div>
        );
    }

    // ──────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────
    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <PackageIcon className="w-8 h-8 text-indigo-600" />
                        Service Packages
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage bundles and track customer subscriptions.
                    </p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'manage'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Manage Packages
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'customers'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Customer Packages
                    </button>
                    <button
                        onClick={() => setActiveTab('transfers')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'transfers'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Transfer Requests
                        {transferRequests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {transferRequests.filter(r => r.status === 'pending').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('extensions')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'extensions'
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Extension Requests
                        {extensionRequests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {extensionRequests.filter(r => r.status === 'pending').length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── MANAGE TAB ─── */}
            {activeTab === 'manage' && (
                <>
                    {/* Create button */}
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showCreateForm ? 'Cancel' : 'Create New Package'}
                        </button>
                    </div>

                    {/* Create form */}
                    {showCreateForm && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
                            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">New Package Details</h2>
                            <form onSubmit={handleCreatePackage} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="e.g., Gold Skin Care Package"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (AED)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            value={formPrice}
                                            onChange={e => setFormPrice(Number(e.target.value))}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validity (Days)</label>
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            value={formValidity}
                                            onChange={e => setFormValidity(Number(e.target.value))}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={formDesc}
                                            onChange={e => setFormDesc(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="Brief description"
                                        />
                                    </div>
                                </div>

                                {/* Service items */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Included Services</h3>

                                    <div className="flex gap-4 mb-4 items-end bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Select Service</label>
                                            <select
                                                value={selectedService}
                                                onChange={e => setSelectedService(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                            >
                                                <option value="">-- Choose a Service --</option>
                                                {serviceOptions.map(svc => (
                                                    <option key={svc.id} value={svc.id}>
                                                        {svc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Sessions</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={sessionCount}
                                                onChange={e => setSessionCount(Number(e.target.value))}
                                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            disabled={!selectedService}
                                            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 text-sm font-medium"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {formItems.length > 0 ? (
                                        <ul className="space-y-2">
                                            {formItems.map((item, index) => (
                                                <li key={index} className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded border border-gray-100 dark:border-gray-600 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                                                            {item.serviceName}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium">
                                                            {item.count} Sessions
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic text-center py-4">
                                            No services added to this package yet.
                                        </p>
                                    )}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={formItems.length === 0}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg font-medium"
                                    >
                                        Create Package
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Package cards */}
                    {packages.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {packages.map(pkg => (
                                <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{pkg.name}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{pkg.description || ''}</p>
                                            </div>
                                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
                                                AED {pkg.price}
                                            </span>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium">Validity:</span> {pkg.validityInDays} Days
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Includes:</span>
                                                <ul className="space-y-1">
                                                    {safeArray<PackageServiceItem>(pkg.items).map((item, idx) => (
                                                        <li key={idx} className="text-sm flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                                                            <span className="text-gray-700 dark:text-gray-300 truncate max-w-[70%]">{item.serviceName}</span>
                                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">x{item.count}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                        <span className="text-xs text-gray-400">
                                            Created {pkg.createdAt ? new Date(pkg.createdAt).toLocaleDateString() : '—'}
                                        </span>
                                        {confirmingDeleteId === pkg.id ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-red-600 font-medium">Delete?</span>
                                                <button
                                                    onClick={() => handleDeletePackage(pkg.id)}
                                                    className="bg-red-600 text-white text-xs px-3 py-1 rounded-md hover:bg-red-700 font-bold transition-colors"
                                                >
                                                    Yes, Delete
                                                </button>
                                                <button
                                                    onClick={() => setConfirmingDeleteId(null)}
                                                    className="text-gray-500 text-xs px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmingDeleteId(pkg.id)}
                                                className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300">
                            <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Packages Yet</h3>
                            <p className="text-sm text-gray-500">Click &quot;Create New Package&quot; to add one.</p>
                        </div>
                    )}
                </>
            )}

            {/* ─── CUSTOMERS TAB ─── */}
            {activeTab === 'customers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Assign + Search */}
                    <div className="lg:col-span-1 space-y-8">
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-indigo-600" />
                                Assign & Bill Package
                            </h2>

                            {assignSuccess && (
                                <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                                    <CheckCircle2 className="w-4 h-4" /> {assignSuccess}
                                </div>
                            )}

                            <form onSubmit={handleAssignPackage} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={custName}
                                        onChange={e => setCustName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                                    <input
                                        required
                                        type="tel"
                                        value={custPhone}
                                        onChange={e => setCustPhone(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="+971 50 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email (optional)</label>
                                    <input
                                        type="email"
                                        value={custEmail}
                                        onChange={e => setCustEmail(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="client@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Package *</label>
                                    <select
                                        required
                                        value={assignPkgId}
                                        onChange={e => setAssignPkgId(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="">-- Choose Package --</option>
                                        {packages.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (AED {p.price})</option>
                                        ))}
                                    </select>
                                    {assignPkgId && (() => {
                                        const sp = packages.find(p => p.id === assignPkgId);
                                        if (!sp) return null;
                                        return (
                                            <div className="mt-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-xs space-y-1">
                                                <div className="flex justify-between"><span className="text-gray-500">Price:</span><span className="font-bold text-indigo-600">AED {sp.price}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Validity:</span><span>{sp.validityInDays} days</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Services:</span><span>{safeArray<PackageServiceItem>(sp.items).map(i => `${i.serviceName} (x${i.count})`).join(', ')}</span></div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Billing Section */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                                        <CreditCard className="w-3.5 h-3.5" /> Payment Details
                                    </h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method *</label>
                                        <select
                                            value={billPaymentMethod}
                                            onChange={e => setBillPaymentMethod(e.target.value as any)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                        >
                                            <option value="card">💳 Credit Card</option>
                                            <option value="cash">💵 Cash</option>
                                            <option value="bank_transfer">🏦 Bank Transfer</option>
                                            <option value="online">🌐 Online</option>
                                        </select>
                                    </div>
                                    <div className="mt-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={billPaymentConfirmed}
                                                onChange={e => setBillPaymentConfirmed(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Payment received & confirmed</span>
                                        </label>
                                        {!billPaymentConfirmed && (
                                            <p className="text-xs text-amber-600 mt-1 ml-7">⚠ Package will be assigned as &quot;pending payment&quot; until confirmed.</p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isAssigning}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {isAssigning ? (
                                        <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> Processing...</>
                                    ) : (
                                        <><Banknote className="w-4 h-4" /> Assign & Generate Invoice</>
                                    )}
                                </button>
                            </form>
                        </section>

                        <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Search className="w-5 h-5 text-gray-500" />
                                Lookup Customer
                            </h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search by Phone</label>
                                <input
                                    type="text"
                                    value={customerPhoneSearch}
                                    onChange={e => setCustomerPhoneSearch(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </section>
                    </div>

                    {/* Right: Customer packages list */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">
                            {customerPhoneSearch ? `Packages for ${customerPhoneSearch}` : 'Customer Packages'}
                        </h2>

                        {customerPackages.length > 0 ? (
                            <div className="space-y-6">
                                {customerPackages.map(cp => {
                                    // Find the package definition - safely
                                    const pkg = packages.find(p => p.id === cp.packageId);
                                    const items = pkg ? safeArray<PackageServiceItem>(pkg.items) : [];
                                    const sessions = cp.remainingSessions || {};

                                    return (
                                        <div key={cp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <div className="p-6 bg-gradient-to-r from-indigo-50 to-white dark:from-gray-700 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300">{cp.packageName || 'Package'}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            <User className="w-4 h-4" />
                                                            {cp.customerName || 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${cp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {cp.active ? 'Active' : 'Inactive'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-2">
                                                            Expires: {cp.expiryDate ? new Date(cp.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Usage Tracking</h4>
                                                {items.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {items.map(item => {
                                                            const remaining = sessions[item.serviceId] ?? 0;
                                                            const total = item.count || 1;
                                                            const percent = Math.min(100, (remaining / total) * 100);

                                                            return (
                                                                <div key={item.serviceId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <span className="font-medium text-gray-900 dark:text-white">{item.serviceName}</span>
                                                                        <span className="text-sm font-bold text-indigo-600">
                                                                            {remaining} / {total} left
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                                                                        <div
                                                                            className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                                                                            style={{ width: `${percent}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleUseSession(cp.id, item.serviceId)}
                                                                        disabled={remaining <= 0}
                                                                        className="w-full py-2 text-sm border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent transition-colors"
                                                                    >
                                                                        {remaining > 0 ? 'Use 1 Session' : 'Completed'}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">Package definition not found. The package may have been deleted.</p>
                                                )}
                                            </div>

                                            {/* Footer with delete option */}
                                            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    {cp.paymentStatus === 'pending' && (
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">⏳ Unpaid</span>
                                                    )}
                                                    {cp.paymentStatus === 'paid' && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">✅ Paid</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                    <button
                                                        onClick={() => setUpgradeModalPkg(cp)}
                                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium bg-indigo-50 px-2 py-1 rounded transition-colors"
                                                    >
                                                        ⬆ Upgrade
                                                    </button>
                                                    <button
                                                        onClick={() => setChangeModalPkg(cp)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    >
                                                        🔄 Change
                                                    </button>
                                                    {confirmingCancelId === cp.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-amber-600 font-medium">Refund to Wallet?</span>
                                                            <button
                                                                onClick={() => handleCancelCustomerPackage(cp.id)}
                                                                className="bg-amber-500 text-white text-xs px-3 py-1 rounded-md hover:bg-amber-600 font-bold transition-colors"
                                                            >
                                                                Yes, Cancel & Refund
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmingCancelId(null)}
                                                                className="text-gray-500 text-xs px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                            >
                                                                Abort
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmingCancelId(cp.id)}
                                                            className="text-amber-600 hover:text-amber-800 text-xs font-medium flex items-center gap-1 transition-colors bg-amber-50 px-2 py-1 rounded"
                                                        >
                                                            <X className="w-3 h-3" /> Cancel & Refund
                                                        </button>
                                                    )}

                                                    {confirmingCustDeleteId === cp.id ? (
                                                        <div className="flex items-center gap-2 ml-2">
                                                            <span className="text-xs text-red-600 font-medium">Remove?</span>
                                                            <button
                                                                onClick={() => handleDeleteCustomerPackage(cp.id)}
                                                                className="bg-red-600 text-white text-xs px-3 py-1 rounded-md hover:bg-red-700 font-bold transition-colors"
                                                            >
                                                                Yes, Delete
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmingCustDeleteId(null)}
                                                                className="text-gray-500 text-xs px-2 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmingCustDeleteId(cp.id)}
                                                            className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1 transition-colors ml-2"
                                                        >
                                                            <Trash2 className="w-3 h-3" /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300">
                                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Packages Found</h3>
                                <p className="text-sm text-gray-500">Search for a customer phone number to view their packages.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── TRANSFERS TAB ─── */}
            {activeTab === 'transfers' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Transfer Requests</h2>
                    {transferRequests.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500">No transfer requests pending.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {transferRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{req.packageName}</h3>
                                    <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">From:</span> {req.fromCustomerName} ({req.fromCustomerPhone})</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">To:</span> {req.toCustomerName} ({req.toCustomerPhone})</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Reason:</span> {req.reason}</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {req.status}</p>
                                    </div>
                                    {req.status === 'pending' && (
                                        <div className="flex gap-3 mt-4">
                                            <button 
                                                onClick={() => handleResolveTransfer(req.id, 'approved')}
                                                disabled={resolvingId === req.id}
                                                className="flex-1 bg-green-100 text-green-700 hover:bg-green-200 py-1.5 rounded text-sm font-medium"
                                            >
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => handleResolveTransfer(req.id, 'rejected')}
                                                disabled={resolvingId === req.id}
                                                className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 py-1.5 rounded text-sm font-medium"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── EXTENSIONS TAB ─── */}
            {activeTab === 'extensions' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Extension Requests</h2>
                    {extensionRequests.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500">No extension requests pending.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {extensionRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{req.packageName}</h3>
                                    <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Customer:</span> {req.customerName} ({req.customerPhone})</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Days:</span> {req.requestedDays}</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Reason:</span> {req.reason}</p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Document:</span> <a href={req.documentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">View</a></p>
                                        <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {req.status}</p>
                                    </div>
                                    {req.status === 'pending' && (
                                        <div className="flex gap-3 mt-4">
                                            <button 
                                                onClick={() => handleResolveExtension(req.id, 'approved')}
                                                disabled={resolvingId === req.id}
                                                className="flex-1 bg-green-100 text-green-700 hover:bg-green-200 py-1.5 rounded text-sm font-medium"
                                            >
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => handleResolveExtension(req.id, 'rejected')}
                                                disabled={resolvingId === req.id}
                                                className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 py-1.5 rounded text-sm font-medium"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* UPGRADE MODAL */}
            {upgradeModalPkg && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-xl">⬆</span> Upgrade Package
                            </h3>
                            <button onClick={() => setUpgradeModalPkg(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select New Tier</label>
                                <select 
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    value={selectedUpgradePkgId}
                                    onChange={(e) => setSelectedUpgradePkgId(e.target.value)}
                                >
                                    <option value="">-- Choose higher tier --</option>
                                    {(() => {
                                        const currentDef = packages.find(p => p.id === upgradeModalPkg.packageId);
                                        const currentServiceId = currentDef?.items[0]?.serviceId;
                                        const higherPackages = packages.filter(p => 
                                            p.id !== upgradeModalPkg.packageId && 
                                            p.price > (currentDef?.price || 0) &&
                                            p.items[0]?.serviceId === currentServiceId
                                        );
                                        return higherPackages.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (AED {p.price})</option>
                                        ));
                                    })()}
                                </select>
                            </div>

                            {selectedUpgradePkgId && (() => {
                                const curDef = packages.find(p => p.id === upgradeModalPkg.packageId);
                                const newDef = packages.find(p => p.id === selectedUpgradePkgId);
                                if (!curDef || !newDef) return null;
                                const cost = newDef.price - curDef.price;
                                return (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 space-y-2 text-sm border border-indigo-100 dark:border-indigo-800/50 mb-6">
                                        <div className="flex justify-between"><span className="text-gray-600">Current Base Price:</span> <span className="font-medium text-gray-900 dark:text-gray-100">AED {curDef.price}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-600">New Base Price:</span> <span className="font-medium text-gray-900 dark:text-gray-100">AED {newDef.price}</span></div>
                                        <div className="border-t border-indigo-200 dark:border-indigo-800 pt-2 flex justify-between font-bold">
                                            <span className="text-indigo-900 dark:text-indigo-300">Amount to Pay:</span>
                                            <span className="text-indigo-600 dark:text-indigo-400">AED {cost}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <form onSubmit={handleUpgradePackage}>
                                {/* Show Billing Mode Options inside Modal so they can easily charge */}
                                {selectedUpgradePkgId && (
                                    <div className="mb-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                            <select
                                                required
                                                value={billPaymentMethod}
                                                onChange={e => setBillPaymentMethod(e.target.value as any)}
                                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                            >
                                                <option value="card">💳 Credit Card</option>
                                                <option value="cash">💵 Cash</option>
                                                <option value="bank_transfer">🏦 Bank Transfer</option>
                                                <option value="online">🌐 Online</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="checkbox" checked={billPaymentConfirmed} onChange={e => setBillPaymentConfirmed(e.target.checked)} className="w-4 h-4 text-indigo-600" />
                                            <span className="text-sm">Payment received</span>
                                        </label>
                                    </div>
                                )}
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setUpgradeModalPkg(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                                    <button type="submit" disabled={!selectedUpgradePkgId || isUpgrading} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold disabled:opacity-50">
                                        {isUpgrading ? 'Processing...' : 'Confirm Upgrade'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* CHANGE MODAL */}
            {changeModalPkg && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-xl">🔄</span> Change Package
                            </h3>
                            <button onClick={() => setChangeModalPkg(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select New Package</label>
                                <select 
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    value={selectedChangePkgId}
                                    onChange={(e) => setSelectedChangePkgId(e.target.value)}
                                >
                                    <option value="">-- Choose new package --</option>
                                    {packages.filter(p => p.id !== changeModalPkg.packageId).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (AED {p.price})</option>
                                    ))}
                                </select>
                            </div>

                            {selectedChangePkgId && (() => {
                                // Simplified display estimate
                                const curDef = packages.find(p => p.id === changeModalPkg.packageId);
                                const newDef = packages.find(p => p.id === selectedChangePkgId);
                                if (!curDef || !newDef) return null;
                                // Estimate remaining value via simple math
                                let totalSess = 0; let remainSess = 0;
                                Object.keys(changeModalPkg.totalSessions).forEach(k => totalSess += changeModalPkg.totalSessions[k]);
                                Object.keys(changeModalPkg.remainingSessions).forEach(k => remainSess += changeModalPkg.remainingSessions[k]);
                                const usedSess = totalSess - remainSess;
                                const sessionPrice = curDef.price / (totalSess || 1);
                                const estRemain = Math.max(0, curDef.price - (usedSess * sessionPrice));
                                const diff = newDef.price - estRemain;
                                
                                return (
                                    <div className={`rounded-lg p-4 space-y-2 text-sm border mb-6 ${diff < 0 ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20' : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20'}`}>
                                        <div className="flex justify-between font-medium"><span className="opacity-80">Estimated Remaining Value:</span> <span>AED {estRemain.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-medium"><span className="opacity-80">New Package Base Price:</span> <span>AED {newDef.price}</span></div>
                                        <div className="border-t border-black/10 pt-2 flex justify-between font-bold mt-2">
                                            {diff > 0 ? (
                                                <><span className="text-blue-900 dark:text-blue-300">Amount to Pay:</span><span className="text-xl">AED {diff.toFixed(2)}</span></>
                                            ) : (
                                                <><span className="text-green-900 dark:text-green-300">Wallet Credit Amount:</span><span className="text-xl">AED {Math.abs(diff).toFixed(2)}</span></>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            <form onSubmit={handleChangePackage}>
                                {/* Setup checkout block */}
                                {selectedChangePkgId && (
                                     <div className="mb-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                            <select
                                                required
                                                value={billPaymentMethod}
                                                onChange={e => setBillPaymentMethod(e.target.value as any)}
                                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                            >
                                                <option value="card">💳 Credit Card</option>
                                                <option value="cash">💵 Cash</option>
                                                <option value="bank_transfer">🏦 Bank Transfer</option>
                                                <option value="online">🌐 Online</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="checkbox" checked={billPaymentConfirmed} onChange={e => setBillPaymentConfirmed(e.target.checked)} className="w-4 h-4 text-indigo-600" />
                                            <span className="text-sm">Payment received</span>
                                        </label>
                                    </div>
                                )}
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setChangeModalPkg(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                                    <button type="submit" disabled={!selectedChangePkgId || isChanging} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold disabled:opacity-50">
                                        {isChanging ? 'Processing...' : 'Confirm Change'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
