'use client';

import React, { useState, useEffect } from 'react';
import { Package, PackageServiceItem, CustomerPackage } from '@/types/packages';
import { Plus, Trash2, Package as PackageIcon, Check, X, Search, User, Calendar, Activity } from 'lucide-react';

class PackagesErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
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
                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Something went wrong</h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">The Packages page encountered an error. Please try refreshing.</p>
                        <pre className="text-xs bg-red-100 dark:bg-red-900/40 p-3 rounded overflow-auto max-h-32 text-red-800 dark:text-red-300">{this.state.error?.message}</pre>
                        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Reload Page</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function PackagesPage() {
    return <PackagesErrorBoundary><PackagesPageInner /></PackagesErrorBoundary>;
}

function PackagesPageInner() {
    const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [activeTab, setActiveTab] = useState<'manage' | 'customers'>('manage');
    const [clinics, setClinics] = useState<any[]>([]);

    // Create Package Form State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState<Omit<Package, 'id' | 'createdAt' | 'active'>>({
        name: '',
        description: '',
        price: 0,
        validityInDays: 30,
        items: []
    });
    const [selectedService, setSelectedService] = useState('');
    const [sessionCount, setSessionCount] = useState(1);

    // Customer Package State
    const [customerPhoneSearch, setCustomerPhoneSearch] = useState('');
    const [assignPackageId, setAssignPackageId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [searchedCustomerPackages, setSearchedCustomerPackages] = useState<CustomerPackage[]>([]);

    const fetchPackages = () => {
        fetch('/api/admin/packages').then(r => r.json()).then(data => {
            setAvailablePackages(Array.isArray(data) ? data : []);
        }).catch(() => {});
    };

    useEffect(() => {
        setIsClient(true);
        fetchPackages();
        fetch('/api/admin/doctors').then(r => r.json()).then(data => {
            setClinics(Array.isArray(data) ? data : []);
        }).catch(() => {});
    }, []);

    if (!isClient) return <div className="p-8">Loading packages...</div>;

    // --- Package Management Handlers ---

    const handleAddItem = () => {
        if (!selectedService) return;

        let serviceName = '';
        let found = false;
        for (const clinic of (clinics || [])) {
            for (const dept of (clinic.departments || [])) {
                const svc = (dept.services || []).find(s => s.id === selectedService);
                if (svc) {
                    serviceName = svc.name;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        const newItem: PackageServiceItem = {
            serviceId: selectedService,
            serviceName,
            count: Number(sessionCount)
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setSelectedService('');
        setSessionCount(1);
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/admin/packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', data: { ...formData, active: true } }),
        });
        setShowCreateForm(false);
        setFormData({ name: '', description: '', price: 0, validityInDays: 30, items: [] });
        fetchPackages();
    };

    // --- Customer Package Handlers ---

    const handleAssignPackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (assignPackageId && customerName && customerPhone) {
            await fetch('/api/admin/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'purchase', packageId: assignPackageId, customerName, customerPhone }),
            });
            alert(`Package assigned to ${customerName}`);
            setAssignPackageId('');
            setCustomerName('');
            setCustomerPhone('');
            setCustomerPhoneSearch(customerPhone);
        }
    };

    const handleUseSession = async (customerPkgId: string, serviceId: string) => {
        const res = await fetch('/api/admin/packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'useSession', customerPackageId: customerPkgId, serviceId }),
        });
        const result = await res.json();
        if (result.success) {
            alert(`Session used! Remaining: ${result.remaining}`);
            // Refresh customer packages
            if (customerPhoneSearch) {
                fetch(`/api/admin/packages?type=customer&phone=${encodeURIComponent(customerPhoneSearch)}`)
                    .then(r => r.json()).then(setSearchedCustomerPackages).catch(() => {});
            }
        } else {
            alert(`Error: ${result.message}`);
        }
    };

    // Fetch customer packages when search changes
    useEffect(() => {
        if (customerPhoneSearch) {
            fetch(`/api/admin/packages?type=customer&phone=${encodeURIComponent(customerPhoneSearch)}`)
                .then(r => r.json()).then(setSearchedCustomerPackages).catch(() => {});
        } else {
            setSearchedCustomerPackages([]);
        }
    }, [customerPhoneSearch]);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <PackageIcon className="w-8 h-8 text-indigo-600" />
                        Service Packages
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage bundles and track customer subscriptions.</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'manage'
                            ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Manage Packages
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'customers'
                            ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                        Customer Packages
                    </button>
                </div>
            </div>

            {/* --- MANAGE PACKAGES TAB --- */}
            {activeTab === 'manage' && (
                <>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showCreateForm ? 'Cancel' : 'Create New Package'}
                        </button>
                    </div>

                    {showCreateForm && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in-down">
                            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">New Package Details</h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validity (Days)</label>
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            value={formData.validityInDays}
                                            onChange={e => setFormData({ ...formData, validityInDays: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={formData.description || ''}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="Brief description"
                                        />
                                    </div>
                                </div>

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
                                                {(clinics || []).flatMap(c => (c.departments || []).flatMap(d => (d.services || []).map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} ({d.name} - {c.name})
                                                    </option>
                                                ))))}
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

                                    {formData.items.length > 0 ? (
                                        <ul className="space-y-2">
                                            {formData.items.map((item, index) => (
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
                                        <p className="text-sm text-gray-500 italic text-center py-4">No services added to this package yet.</p>
                                    )}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={formData.items.length === 0}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg font-medium"
                                    >
                                        Create Package
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availablePackages.map(pkg => (
                            <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{pkg.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{pkg.description}</p>
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
                                                {pkg.items.map((item, idx) => (
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
                                    <span className="text-xs text-gray-400">Created {new Date(pkg.createdAt).toLocaleDateString()}</span>
                                    <button
                                        onClick={async () => { await fetch('/api/admin/packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: pkg.id }) }); fetchPackages(); }}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* --- CUSTOMER PACKAGES TAB --- */}
            {activeTab === 'customers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Assign Package */}
                    <div className="lg:col-span-1 space-y-8">
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-600" />
                                Assign Package
                            </h2>
                            <form onSubmit={handleAssignPackage} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                                    <input
                                        required
                                        type="tel"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="+971 50 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Package</label>
                                    <select
                                        required
                                        value={assignPackageId}
                                        onChange={e => setAssignPackageId(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="">-- Choose Package --</option>
                                        {availablePackages.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (AED {p.price})</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium"
                                >
                                    Assign Package
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
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customerPhoneSearch}
                                        onChange={e => setCustomerPhoneSearch(e.target.value)}
                                        className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="Enter phone number"
                                    />
                                    <button
                                        onClick={() => setCustomerPhoneSearch(customerPhoneSearch)}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        Search
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right: Customer Packages List */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">
                            {customerPhoneSearch ? `Packages for ${customerPhoneSearch}` : 'Customer Packages'}
                        </h2>

                        {searchedCustomerPackages.length > 0 ? (
                            <div className="space-y-6">
                                {searchedCustomerPackages.map(cp => {
                                    const pkg = availablePackages.find(p => p.id === cp.packageId);
                                    return (
                                        <div key={cp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <div className="p-6 bg-gradient-to-r from-indigo-50 to-white dark:from-gray-700 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300">{cp.packageName}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            <User className="w-4 h-4" />
                                                            {cp.customerName}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${cp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {cp.active ? 'Active' : 'Inactive'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-2">
                                                            Expires: {new Date(cp.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Usage Tracking</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {(pkg?.items || []).map(item => {
                                                        const remaining = cp.remainingSessions[item.serviceId] ?? 0;
                                                        const total = item.count;
                                                        const percent = (remaining / total) * 100;

                                                        return (
                                                            <div key={item.serviceId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="font-medium text-gray-900 dark:text-white">{item.serviceName}</span>
                                                                    <span className="text-sm font-bold text-indigo-600">
                                                                        {remaining} / {total} left
                                                                    </span>
                                                                </div>

                                                                {/* Progress Bar */}
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
        </div>
    );
}
