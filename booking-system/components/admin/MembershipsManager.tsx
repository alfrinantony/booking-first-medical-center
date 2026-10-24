'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    MembershipTier,
    CustomerMembership,
    AllowedProcedure,
    MembershipPrivilegeDef,
    PrivilegeCategory
} from '@/types/memberships';
import {
    Crown,
    Plus,
    Search,
    User,
    Calendar,
    Receipt,
    CreditCard,
    CheckCircle2,
    X,
    Trash2,
    Clock,
    Sparkles,
    ShieldCheck,
    Layers,
    Tag,
    Upload,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Check,
    DollarSign,
    Percent,
    Award,
    Activity,
    FileText,
    History,
    Stethoscope,
    Building2,
    Filter
} from 'lucide-react';

interface ServiceOption {
    id: string;
    name: string;
    deptName: string;
    clinicName: string;
    price?: number;
}

const PRESET_PICTURES = [
    {
        name: 'Diamond Prestige',
        url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
        gradient: 'from-slate-900 via-indigo-950 to-blue-900'
    },
    {
        name: 'Gold Luxury',
        url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
        gradient: 'from-amber-900 via-yellow-900 to-orange-950'
    },
    {
        name: 'Emerald Healthcare',
        url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
        gradient: 'from-emerald-950 via-teal-900 to-slate-900'
    },
    {
        name: 'Rose Gold Aesthetic',
        url: 'https://images.unsplash.com/photo-1512290900672-1f0233333333?auto=format&fit=crop&w=800&q=80',
        gradient: 'from-rose-950 via-pink-900 to-purple-950'
    },
    {
        name: 'Sapphire Wellness',
        url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80',
        gradient: 'from-blue-950 via-cyan-900 to-slate-900'
    }
];

export default function MembershipsManager({ initialPhone }: { initialPhone?: string }) {
    const [activeSubTab, setActiveSubTab] = useState<'clients' | 'tiers' | 'privileges'>('clients');

    // Data states
    const [tiers, setTiers] = useState<MembershipTier[]>([]);
    const [customerMemberships, setCustomerMemberships] = useState<CustomerMembership[]>([]);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [privileges, setPrivileges] = useState<MembershipPrivilegeDef[]>([]);
    const [loading, setLoading] = useState(true);

    // Privileges tab states
    const [showPrivilegeModal, setShowPrivilegeModal] = useState(false);
    const [editingPrivilege, setEditingPrivilege] = useState<MembershipPrivilegeDef | null>(null);
    const [privTitle, setPrivTitle] = useState('');
    const [privCategory, setPrivCategory] = useState<PrivilegeCategory>('VIP Service');
    const [privDesc, setPrivDesc] = useState('');
    const [privBadgeColor, setPrivBadgeColor] = useState('amber');
    const [privSearch, setPrivSearch] = useState('');
    const [privCategoryFilter, setPrivCategoryFilter] = useState<string>('all');
    const [savingPrivilege, setSavingPrivilege] = useState(false);

    // Search and filter states
    const [phoneSearch, setPhoneSearch] = useState(initialPhone || '');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modals
    const [showCreateTierModal, setShowCreateTierModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
    const [selectedMembershipForHistory, setSelectedMembershipForHistory] = useState<CustomerMembership | null>(null);

    // Procedure usage session modal
    const [redeemModal, setRedeemModal] = useState<{
        open: boolean;
        membership: CustomerMembership | null;
        serviceId: string;
        serviceName: string;
        doctorName: string;
        clinicName: string;
        notes: string;
        submitting: boolean;
    }>({
        open: false,
        membership: null,
        serviceId: '',
        serviceName: '',
        doctorName: '',
        clinicName: 'First Medical Center',
        notes: '',
        submitting: false
    });

    // ── Create/Edit Tier Form State ──
    const [tierName, setTierName] = useState('');
    const [tierCode, setTierCode] = useState('');
    const [tierDesc, setTierDesc] = useState('');
    const [tierPictureUrl, setTierPictureUrl] = useState(PRESET_PICTURES[0].url);
    const [tierDurationVal, setTierDurationVal] = useState(1);
    const [tierDurationUnit, setTierDurationUnit] = useState<'days' | 'months' | 'years'>('years');
    const [tierPrice, setTierPrice] = useState<number>(3000);
    const [tierVatRate, setTierVatRate] = useState<number>(5);
    const [tierPrivileges, setTierPrivileges] = useState<string[]>([
        'Dedicated Priority Doctor Hotline & Walk-in Access',
        'Complimentary Valet Parking across all FMC Clinics',
        '10% Courtesy Discount on Pharmacy & Lab Tests'
    ]);
    const [newPrivilegeInput, setNewPrivilegeInput] = useState('');
    const [tierProcedures, setTierProcedures] = useState<AllowedProcedure[]>([]);

    // Sub-form for adding procedure to tier
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [procedureSessionLimit, setProcedureSessionLimit] = useState<number>(4);
    const [procedureIsUnlimited, setProcedureIsUnlimited] = useState(false);
    const [procedureDiscount, setProcedureDiscount] = useState<number>(100);
    const [procedureNotes, setProcedureNotes] = useState('');

    // ── Client Assignment Form State ──
    const [assignTierId, setAssignTierId] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'bank_transfer' | 'online'>('card');
    const [paymentConfirmed, setPaymentConfirmed] = useState(true);
    const [assignNotes, setAssignNotes] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignFeedback, setAssignFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch All Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Tiers
            const tiersRes = await fetch('/api/admin/memberships?type=tiers&includeInactive=true');
            if (tiersRes.ok) {
                const data = await tiersRes.json();
                setTiers(Array.isArray(data) ? data : []);
            }

            // 2. Customer memberships
            const cmRes = await fetch('/api/admin/memberships?type=all-customer');
            if (cmRes.ok) {
                const data = await cmRes.json();
                setCustomerMemberships(Array.isArray(data) ? data : []);
            }

            // 2b. Privileges Catalog
            const privRes = await fetch('/api/admin/memberships?type=privileges&includeInactive=true');
            if (privRes.ok) {
                const pData = await privRes.json();
                setPrivileges(Array.isArray(pData) ? pData : []);
            }

            // 3. Services for procedures selector
            const svcRes = await fetch('/api/admin/doctors');
            if (svcRes.ok) {
                const clinics = await svcRes.json();
                const list: ServiceOption[] = [];
                const seen = new Set<string>();
                if (Array.isArray(clinics)) {
                    for (const clinic of clinics) {
                        for (const dept of (clinic.departments || [])) {
                            for (const s of (dept.services || [])) {
                                if (s && s.id && !seen.has(s.id)) {
                                    seen.add(s.id);
                                    list.push({
                                        id: s.id,
                                        name: s.name || 'Unnamed',
                                        deptName: dept.name || 'General',
                                        clinicName: clinic.name || 'Main Clinic',
                                        price: s.price
                                    });
                                }
                            }
                        }
                    }
                }
                setServices(list);
            }
        } catch (err) {
            console.error('[MembershipsManager] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Live VAT calculations for Tier Form
    const computedVatAmount = useMemo(() => {
        return Number(((tierPrice * tierVatRate) / 100).toFixed(2));
    }, [tierPrice, tierVatRate]);

    const computedTotalPrice = useMemo(() => {
        return Number((tierPrice + computedVatAmount).toFixed(2));
    }, [tierPrice, computedVatAmount]);

    // Handle adding privilege
    const handleAddPrivilege = () => {
        if (!newPrivilegeInput.trim()) return;
        setTierPrivileges(prev => [...prev, newPrivilegeInput.trim()]);
        setNewPrivilegeInput('');
    };

    const handleRemovePrivilege = (index: number) => {
        setTierPrivileges(prev => prev.filter((_, i) => i !== index));
    };

    // Handle adding procedure to tier
    const handleAddProcedure = () => {
        if (!selectedServiceId) return;
        const svc = services.find(s => s.id === selectedServiceId);
        if (!svc) return;

        // Check if already added
        if (tierProcedures.some(p => p.serviceId === svc.id)) {
            alert('This procedure is already added to the tier.');
            return;
        }

        const newProc: AllowedProcedure = {
            serviceId: svc.id,
            serviceName: svc.name,
            deptName: svc.deptName,
            clinicName: svc.clinicName,
            sessionLimit: procedureIsUnlimited ? -1 : (Number(procedureSessionLimit) || 1),
            discountPercent: Number(procedureDiscount) || 100,
            notes: procedureNotes.trim() || undefined
        };

        setTierProcedures(prev => [...prev, newProc]);
        setSelectedServiceId('');
        setProcedureSessionLimit(4);
        setProcedureIsUnlimited(false);
        setProcedureNotes('');
    };

    const handleRemoveProcedure = (serviceId: string) => {
        setTierProcedures(prev => prev.filter(p => p.serviceId !== serviceId));
    };

    // Open tier form for edit
    const openEditTier = (tier: MembershipTier) => {
        setEditingTier(tier);
        setTierName(tier.name);
        setTierCode(tier.code);
        setTierDesc(tier.description || '');
        setTierPictureUrl(tier.pictureUrl || PRESET_PICTURES[0].url);
        setTierDurationVal(tier.durationValue);
        setTierDurationUnit(tier.durationUnit);
        setTierPrice(tier.price);
        setTierVatRate(tier.vatRate);
        setTierPrivileges(tier.privileges || []);
        setTierProcedures(tier.allowedProcedures || []);
        setShowCreateTierModal(true);
    };

    const resetTierForm = () => {
        setEditingTier(null);
        setTierName('');
        setTierCode('FMC-VIP-' + Math.floor(100 + Math.random() * 900));
        setTierDesc('');
        setTierPictureUrl(PRESET_PICTURES[0].url);
        setTierDurationVal(1);
        setTierDurationUnit('years');
        setTierPrice(3000);
        setTierVatRate(5);
        setTierPrivileges([
            'Dedicated Priority Doctor Hotline & Walk-in Access',
            'Complimentary Valet Parking across all FMC Clinics',
            '10% Courtesy Discount on Pharmacy & Lab Tests'
        ]);
        setTierProcedures([]);
    };

    // Save Tier (Create or Update)
    const handleSaveTier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tierName.trim()) {
            alert('Please provide a name for the membership.');
            return;
        }

        try {
            const payload = {
                name: tierName.trim(),
                code: tierCode.trim() || `FMC-MEM-${Date.now().toString().slice(-4)}`,
                description: tierDesc.trim(),
                pictureUrl: tierPictureUrl,
                durationValue: Number(tierDurationVal) || 1,
                durationUnit: tierDurationUnit,
                price: Number(tierPrice) || 0,
                vatRate: Number(tierVatRate) || 5,
                privileges: tierPrivileges,
                allowedProcedures: tierProcedures,
                active: true
            };

            if (editingTier) {
                const res = await fetch('/api/admin/memberships', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateTier',
                        id: editingTier.id,
                        updates: payload
                    })
                });
                if (res.ok) {
                    setShowCreateTierModal(false);
                    resetTierForm();
                    fetchData();
                } else {
                    alert('Failed to update membership tier.');
                }
            } else {
                const res = await fetch('/api/admin/memberships', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'createTier',
                        data: payload
                    })
                });
                if (res.ok) {
                    setShowCreateTierModal(false);
                    resetTierForm();
                    fetchData();
                } else {
                    alert('Failed to create membership tier.');
                }
            }
        } catch (err) {
            console.error('Save tier error:', err);
            alert('An error occurred while saving the membership tier.');
        }
    };

    // Delete tier
    const handleDeleteTier = async (tierId: string, tierName: string) => {
        if (!confirm(`Are you sure you want to delete tier "${tierName}"?`)) return;
        try {
            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteTier', id: tierId })
            });
            if (res.ok) {
                fetchData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Handle Assigning Membership to Client
    const handleAssignMembership = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignTierId || !clientName || !clientPhone) {
            alert('Please select a membership tier, and enter client name and phone.');
            return;
        }

        setIsAssigning(true);
        setAssignFeedback(null);

        try {
            const stored = sessionStorage.getItem('adminUser');
            const staffName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';

            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    data: {
                        membershipTierId: assignTierId,
                        customerName: clientName.trim(),
                        customerPhone: clientPhone.trim(),
                        customerEmail: clientEmail.trim() || undefined,
                        startDate: startDate,
                        paymentMethod,
                        paymentConfirmed,
                        staffName,
                        notes: assignNotes.trim() || undefined
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setAssignFeedback({
                    type: 'success',
                    message: `Membership assigned! Invoice ${data.invoiceNumber || ''} generated successfully.`
                });
                setPhoneSearch(clientPhone);
                setTimeout(() => {
                    setShowAssignModal(false);
                    setClientName('');
                    setClientPhone('');
                    setClientEmail('');
                    setAssignNotes('');
                    setAssignTierId('');
                    setAssignFeedback(null);
                    fetchData();
                }, 1500);
            } else {
                setAssignFeedback({
                    type: 'error',
                    message: data.error || 'Failed to assign membership.'
                });
            }
        } catch (err: any) {
            console.error('Assign error:', err);
            setAssignFeedback({
                type: 'error',
                message: err.message || 'Network error occurred.'
            });
        } finally {
            setIsAssigning(false);
        }
    };

    // Handle Procedure Usage
    const handleConfirmRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!redeemModal.membership) return;

        setRedeemModal(prev => ({ ...prev, submitting: true }));
        try {
            const stored = sessionStorage.getItem('adminUser');
            const staffName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';

            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'useProcedure',
                    customerMembershipId: redeemModal.membership.id,
                    serviceId: redeemModal.serviceId,
                    details: {
                        doctorName: redeemModal.doctorName.trim() || undefined,
                        clinicName: redeemModal.clinicName.trim() || undefined,
                        recordedBy: staffName,
                        notes: redeemModal.notes.trim() || undefined
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert(`Session redeemed successfully! Remaining: ${data.remaining}`);
                setRedeemModal({
                    open: false,
                    membership: null,
                    serviceId: '',
                    serviceName: '',
                    doctorName: '',
                    clinicName: 'First Medical Center',
                    notes: '',
                    submitting: false
                });
                fetchData();
            } else {
                alert(data.message || 'Failed to redeem session');
                setRedeemModal(prev => ({ ...prev, submitting: false }));
            }
        } catch (err) {
            console.error('Redeem error:', err);
            alert('Failed to record session redemption.');
            setRedeemModal(prev => ({ ...prev, submitting: false }));
        }
    };

    // Status change for Customer Membership
    const handleChangeStatus = async (cmId: string, newStatus: 'active' | 'suspended' | 'cancelled') => {
        if (!confirm(`Update membership status to ${newStatus}?`)) return;
        try {
            const stored = sessionStorage.getItem('adminUser');
            const staffName = stored ? JSON.parse(stored).name || 'Admin' : 'Admin';
            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    id: cmId,
                    status: newStatus,
                    staffName
                })
            });
            if (res.ok) fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    // Reset & open privilege modal
    const resetPrivilegeForm = () => {
        setEditingPrivilege(null);
        setPrivTitle('');
        setPrivCategory('VIP Service');
        setPrivDesc('');
        setPrivBadgeColor('amber');
    };

    const openEditPrivilege = (p: MembershipPrivilegeDef) => {
        setEditingPrivilege(p);
        setPrivTitle(p.title);
        setPrivCategory(p.category);
        setPrivDesc(p.description || '');
        setPrivBadgeColor(p.badgeColor || 'amber');
        setShowPrivilegeModal(true);
    };

    const handleSavePrivilege = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!privTitle.trim()) {
            alert('Please provide a title for the privilege.');
            return;
        }

        setSavingPrivilege(true);
        try {
            if (editingPrivilege) {
                const res = await fetch('/api/admin/memberships', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updatePrivilege',
                        id: editingPrivilege.id,
                        updates: {
                            title: privTitle.trim(),
                            category: privCategory,
                            description: privDesc.trim(),
                            badgeColor: privBadgeColor
                        }
                    })
                });
                if (res.ok) {
                    setShowPrivilegeModal(false);
                    resetPrivilegeForm();
                    fetchData();
                } else {
                    alert('Failed to update privilege.');
                }
            } else {
                const res = await fetch('/api/admin/memberships', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'createPrivilege',
                        data: {
                            title: privTitle.trim(),
                            category: privCategory,
                            description: privDesc.trim(),
                            badgeColor: privBadgeColor,
                            active: true
                        }
                    })
                });
                if (res.ok) {
                    setShowPrivilegeModal(false);
                    resetPrivilegeForm();
                    fetchData();
                } else {
                    alert('Failed to create privilege.');
                }
            }
        } catch (e) {
            console.error('Error saving privilege:', e);
            alert('Error occurred while saving privilege.');
        } finally {
            setSavingPrivilege(false);
        }
    };

    const handleDeletePrivilege = async (id: string, title: string) => {
        if (!confirm(`Delete membership privilege "${title}"?`)) return;
        try {
            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePrivilege', id })
            });
            if (res.ok) fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleTogglePrivilege = async (id: string) => {
        try {
            const res = await fetch('/api/admin/memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'togglePrivilege', id })
            });
            if (res.ok) fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Filtered Privileges
    const filteredPrivileges = useMemo(() => {
        return privileges.filter(p => {
            const matchesSearch = !privSearch.trim() ||
                p.title.toLowerCase().includes(privSearch.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(privSearch.toLowerCase());
            const matchesCat = privCategoryFilter === 'all' || p.category === privCategoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [privileges, privSearch, privCategoryFilter]);

    // Filtered Customer Memberships
    const filteredCustomerMemberships = useMemo(() => {
        return customerMemberships.filter(cm => {
            const matchesPhone = !phoneSearch.trim() ||
                cm.customerPhone.toLowerCase().includes(phoneSearch.toLowerCase()) ||
                cm.customerName.toLowerCase().includes(phoneSearch.toLowerCase()) ||
                cm.membershipCode.toLowerCase().includes(phoneSearch.toLowerCase());

            const matchesStatus = statusFilter === 'all' || cm.status === statusFilter;
            return matchesPhone && matchesStatus;
        });
    }, [customerMemberships, phoneSearch, statusFilter]);

    // Active Counts
    const stats = useMemo(() => {
        const activeCount = customerMemberships.filter(c => c.status === 'active').length;
        const totalRevenue = customerMemberships.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
        const totalVat = customerMemberships.reduce((sum, c) => sum + (c.vatAmount || 0), 0);
        return { activeCount, totalRevenue, totalVat, totalTiers: tiers.length };
    }, [customerMemberships, tiers]);

    return (
        <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Active Members</p>
                            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{stats.activeCount}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Crown className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Active VIP subscriptions</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200 dark:border-indigo-900/50 p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Membership Tiers</p>
                            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{stats.totalTiers}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <Layers className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Available club plans</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200 dark:border-emerald-900/50 p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Revenue</p>
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">AED {stats.totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Collected (incl. VAT)</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-200 dark:border-purple-900/50 p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Total VAT Collected</p>
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">AED {stats.totalVat.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Percent className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">5% Standard UAE Tax</p>
                </div>
            </div>

            {/* Navigation and Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded-xl">
                    <button
                        onClick={() => setActiveSubTab('clients')}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                            activeSubTab === 'clients'
                                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                        }`}
                    >
                        <User className="w-4 h-4" />
                        Client Memberships
                        <span className="ml-1 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                            {customerMemberships.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveSubTab('tiers')}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                            activeSubTab === 'tiers'
                                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                        }`}
                    >
                        <Crown className="w-4 h-4 text-amber-500" />
                        Membership Tiers & Plans
                        <span className="ml-1 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            {tiers.length}
                        </span>
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <a
                        href="/admin/memberships/agreement"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-200 dark:border-slate-600"
                    >
                        <FileText className="w-4 h-4 text-amber-600" />
                        Patient Agreement (EN / AR)
                    </a>
                    <button
                        onClick={() => {
                            resetTierForm();
                            setShowCreateTierModal(true);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        New Membership Plan
                    </button>
                    <button
                        onClick={() => {
                            if (tiers.length === 0) {
                                alert('Please create at least one membership tier first.');
                                return;
                            }
                            setAssignTierId(tiers[0]?.id || '');
                            setShowAssignModal(true);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                    >
                        <Award className="w-4 h-4" />
                        Enroll Client
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SUBTAB 1: CLIENT MEMBERSHIPS
               ══════════════════════════════════════════════════════════ */}
            {activeSubTab === 'clients' && (
                <div className="space-y-6">
                    {/* Search & Status Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={phoneSearch}
                                onChange={e => setPhoneSearch(e.target.value)}
                                placeholder="Search by client name, phone number, or membership code..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            />
                            {phoneSearch && (
                                <button
                                    onClick={() => setPhoneSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active Only</option>
                                <option value="expired">Expired</option>
                                <option value="suspended">Suspended</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Memberships Cards List */}
                    {loading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="text-sm text-gray-500 mt-3">Loading client memberships...</p>
                        </div>
                    ) : filteredCustomerMemberships.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredCustomerMemberships.map(cm => {
                                const isExpired = cm.status === 'expired' || (cm.expiryDate && new Date(cm.expiryDate) < new Date());
                                const daysLeft = Math.ceil((new Date(cm.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <div
                                        key={cm.id}
                                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                                    >
                                        {/* Card Header with Picture / Gradient */}
                                        <div className="relative p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden">
                                            {cm.pictureUrl && (
                                                <div
                                                    className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
                                                    style={{ backgroundImage: `url(${cm.pictureUrl})` }}
                                                />
                                            )}
                                            <div className="relative z-10 flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="p-1 rounded bg-amber-400/20 text-amber-300">
                                                            <Crown className="w-4 h-4" />
                                                        </span>
                                                        <span className="text-xs font-mono tracking-widest text-amber-300 uppercase">
                                                            {cm.membershipCode}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-white tracking-tight">
                                                        {cm.membershipName}
                                                    </h3>
                                                    <p className="text-sm text-indigo-200 mt-1 flex items-center gap-1.5 font-medium">
                                                        <User className="w-3.5 h-3.5" />
                                                        {cm.customerName}
                                                        <span className="text-xs opacity-75">({cm.customerPhone})</span>
                                                    </p>
                                                </div>

                                                <div className="text-right">
                                                    <span
                                                        className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider inline-block ${
                                                            cm.status === 'active' && !isExpired
                                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        }`}
                                                    >
                                                        {isExpired ? 'Expired' : cm.status}
                                                    </span>
                                                    <div className="text-[11px] text-gray-300 mt-2">
                                                        {daysLeft > 0 ? (
                                                            <span className="text-emerald-300 font-semibold">{daysLeft} days remaining</span>
                                                        ) : (
                                                            <span className="text-red-300 font-semibold">Expired {Math.abs(daysLeft)} days ago</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Membership validity & Financial Bar */}
                                            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                                                    <span>
                                                        {new Date(cm.startDate).toLocaleDateString()} — {new Date(cm.expiryDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-white/10 px-2 py-0.5 rounded text-white font-bold">
                                                        AED {cm.totalPrice} <span className="text-[10px] font-normal text-indigo-200">(VAT 5% AED {cm.vatAmount})</span>
                                                    </span>
                                                    {cm.invoiceNumber && (
                                                        <span className="text-[11px] text-indigo-300 font-mono">
                                                            Inv: {cm.invoiceNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Body: Procedures Covered & Usage Tracker */}
                                        <div className="p-6 space-y-5">
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
                                                    <span>Procedures Allowed & Usage</span>
                                                    <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400">
                                                        {cm.allowedProcedures.length} Procedures Included
                                                    </span>
                                                </h4>

                                                {cm.allowedProcedures.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {cm.allowedProcedures.map((proc, idx) => {
                                                            const isUnlimited = proc.totalAllowed === -1;
                                                            const percentUsed = isUnlimited
                                                                ? 100
                                                                : Math.min(100, Math.round(((proc.totalAllowed - proc.remainingCount) / proc.totalAllowed) * 100));
                                                            const canRedeem = cm.status === 'active' && !isExpired && (isUnlimited || proc.remainingCount > 0);

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3 rounded-xl flex flex-col justify-between"
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="max-w-[70%]">
                                                                            <span className="font-semibold text-sm text-gray-900 dark:text-white block truncate">
                                                                                {proc.serviceName}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                                {proc.deptName || 'Specialist Care'} {proc.clinicName ? `• ${proc.clinicName}` : ''}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            {isUnlimited ? (
                                                                                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">
                                                                                    Unlimited ({proc.usedCount} used)
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                                                                                    {proc.remainingCount} / {proc.totalAllowed} Left
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Mini Progress bar if limited */}
                                                                    {!isUnlimited && (
                                                                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-2">
                                                                            <div
                                                                                className="bg-indigo-600 h-1.5 rounded-full"
                                                                                style={{ width: `${100 - percentUsed}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/50 dark:border-gray-600/50 mt-1">
                                                                        <span className="text-[11px] text-gray-500">
                                                                            {proc.discountPercent === 100 ? '100% Free Included' : `${proc.discountPercent}% Off`}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => {
                                                                                setRedeemModal({
                                                                                    open: true,
                                                                                    membership: cm,
                                                                                    serviceId: proc.serviceId,
                                                                                    serviceName: proc.serviceName,
                                                                                    doctorName: '',
                                                                                    clinicName: proc.clinicName || 'First Medical Center',
                                                                                    notes: '',
                                                                                    submitting: false
                                                                                });
                                                                            }}
                                                                            disabled={!canRedeem}
                                                                            className="text-xs font-semibold px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors flex items-center gap-1"
                                                                        >
                                                                            <Activity className="w-3 h-3" />
                                                                            Record 1 Session
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">No specific procedures designated for this tier.</p>
                                                )}
                                            </div>

                                            {/* Privileges Pill list */}
                                            {cm.privileges && cm.privileges.length > 0 && (
                                                <div className="pt-2">
                                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                                                        Member Privileges & Perks
                                                    </h5>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {cm.privileges.map((priv, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/40 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                            >
                                                                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                                                {priv}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer Actions */}
                                        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                                            <button
                                                onClick={() => setSelectedMembershipForHistory(cm)}
                                                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                                Usage History ({cm.usageHistory?.length || 0})
                                            </button>

                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`/admin/memberships/agreement?name=${encodeURIComponent(cm.customerName)}&phone=${encodeURIComponent(cm.customerPhone)}&membership=${encodeURIComponent(cm.membershipName)}&amount=${encodeURIComponent('AED ' + cm.totalPrice)}&startDate=${encodeURIComponent(cm.startDate ? cm.startDate.split('T')[0] : '')}&expiryDate=${encodeURIComponent(cm.expiryDate ? cm.expiryDate.split('T')[0] : '')}&term=${encodeURIComponent(cm.durationValue + ' ' + cm.durationUnit)}&receipt=${encodeURIComponent(cm.invoiceNumber || '')}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/40 px-2 py-1 rounded font-semibold flex items-center gap-1 transition-colors text-[11px]"
                                                    title="Print Patient Agreement (Bilingual EN/AR)"
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    Agreement (EN/AR)
                                                </a>
                                                {cm.status === 'active' && (
                                                    <button
                                                        onClick={() => handleChangeStatus(cm.id, 'suspended')}
                                                        className="text-gray-500 hover:text-amber-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {cm.status === 'suspended' && (
                                                    <button
                                                        onClick={() => handleChangeStatus(cm.id, 'active')}
                                                        className="text-emerald-600 font-semibold px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                    >
                                                        Re-activate
                                                    </button>
                                                )}
                                                {cm.status !== 'cancelled' && (
                                                    <button
                                                        onClick={() => handleChangeStatus(cm.id, 'cancelled')}
                                                        className="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                            <Crown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No Client Memberships Found</h3>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                                {phoneSearch
                                    ? `No memberships found matching "${phoneSearch}".`
                                    : 'Enroll your first client in a membership club to get started.'}
                            </p>
                            <button
                                onClick={() => {
                                    if (tiers.length === 0) {
                                        resetTierForm();
                                        setShowCreateTierModal(true);
                                    } else {
                                        setAssignTierId(tiers[0]?.id || '');
                                        setShowAssignModal(true);
                                    }
                                }}
                                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {tiers.length === 0 ? 'Create First Membership Plan' : 'Enroll a Client Now'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                SUBTAB 2: MEMBERSHIP TIERS & PLANS
               ══════════════════════════════════════════════════════════ */}
            {activeSubTab === 'tiers' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Membership Plans</h3>
                            <p className="text-sm text-gray-500">Configure duration, price, VAT, privileges, and procedures for each tier.</p>
                        </div>
                        <button
                            onClick={() => {
                                resetTierForm();
                                setShowCreateTierModal(true);
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Create New Tier
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tiers.map(tier => (
                            <div
                                key={tier.id}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <div>
                                    {/* Picture / Header Banner */}
                                    <div className="relative h-44 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden p-5 flex flex-col justify-between text-white">
                                        {tier.pictureUrl && (
                                            <div
                                                className="absolute inset-0 bg-cover bg-center opacity-30"
                                                style={{ backgroundImage: `url(${tier.pictureUrl})` }}
                                            />
                                        )}
                                        <div className="relative z-10 flex justify-between items-start">
                                            <span className="text-[11px] font-mono tracking-widest text-amber-300 uppercase px-2 py-0.5 rounded bg-black/40 border border-amber-300/30">
                                                {tier.code}
                                            </span>
                                            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                                {tier.durationValue} {tier.durationUnit}
                                            </span>
                                        </div>
                                        <div className="relative z-10">
                                            <h4 className="text-xl font-bold text-white leading-tight drop-shadow-sm">
                                                {tier.name}
                                            </h4>
                                            <p className="text-xs text-indigo-200 line-clamp-1 mt-1">
                                                {tier.description || 'Exclusive medical & aesthetic membership'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Pricing & VAT Box */}
                                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30">
                                        <div className="flex justify-between items-baseline">
                                            <div>
                                                <span className="text-xs text-gray-500 uppercase font-semibold">Total with VAT</span>
                                                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                                    AED {tier.totalPrice}
                                                </div>
                                            </div>
                                            <div className="text-right text-xs text-gray-500">
                                                <div>Base: AED {tier.price}</div>
                                                <div className="text-amber-600 dark:text-amber-400 font-medium">VAT ({tier.vatRate}%): AED {tier.vatAmount}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Procedures & Privileges */}
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                                                Procedures Included ({tier.allowedProcedures?.length || 0})
                                            </span>
                                            <ul className="space-y-1.5 text-xs">
                                                {(tier.allowedProcedures || []).slice(0, 4).map((p, i) => (
                                                    <li key={i} className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                                                        <span className="truncate max-w-[70%]">• {p.serviceName}</span>
                                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                            {p.sessionLimit === -1 ? 'Unlimited' : `${p.sessionLimit} sess.`}
                                                        </span>
                                                    </li>
                                                ))}
                                                {(tier.allowedProcedures?.length || 0) > 4 && (
                                                    <li className="text-[11px] text-gray-400 italic">
                                                        +{tier.allowedProcedures.length - 4} more procedures
                                                    </li>
                                                )}
                                            </ul>
                                        </div>

                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                                                Privileges & Perks
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                                {(tier.privileges || []).slice(0, 3).map((priv, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-[11px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full"
                                                    >
                                                        {priv}
                                                    </span>
                                                ))}
                                                {(tier.privileges?.length || 0) > 3 && (
                                                    <span className="text-[11px] text-gray-400 px-1">
                                                        +{tier.privileges.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <button
                                        onClick={() => {
                                            setAssignTierId(tier.id);
                                            setShowAssignModal(true);
                                        }}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5"
                                    >
                                        <Award className="w-3.5 h-3.5" />
                                        Enroll Client
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditTier(tier)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTier(tier.id, tier.name)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Delete Tier"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL: CREATE / EDIT MEMBERSHIP TIER
               ══════════════════════════════════════════════════════════ */}
            {showCreateTierModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-200 dark:border-gray-700 my-8">
                        <div className="p-6 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white/20">
                                    <Crown className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">
                                        {editingTier ? 'Edit Membership Plan' : 'Create New Membership Plan'}
                                    </h3>
                                    <p className="text-xs text-amber-100">
                                        Configure privileges, duration, price, VAT, and procedure allowances
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreateTierModal(false)}
                                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTier} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            {/* Row 1: Membership Name & Code (Privilege to Name) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Membership Name * (Privilege to Name)
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={tierName}
                                        onChange={e => setTierName(e.target.value)}
                                        placeholder="e.g. Diamond VIP Care Pass, Gold Aesthetic Club"
                                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Tier Code
                                    </label>
                                    <input
                                        type="text"
                                        value={tierCode}
                                        onChange={e => setTierCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. FMC-VIP-01"
                                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-mono uppercase"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Description & Scope
                                </label>
                                <textarea
                                    rows={2}
                                    value={tierDesc}
                                    onChange={e => setTierDesc(e.target.value)}
                                    placeholder="Brief overview of benefits, audience, and treatment inclusions..."
                                    className="w-full px-4 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            {/* Row 2: Picture of the Membership */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                    Picture of the Membership (Select Preset or Provide Image URL)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
                                    {PRESET_PICTURES.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setTierPictureUrl(preset.url)}
                                            className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all p-1 text-left flex flex-col justify-end ${
                                                tierPictureUrl === preset.url
                                                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                                                    : 'border-gray-200 dark:border-gray-700 opacity-80 hover:opacity-100'
                                            }`}
                                        >
                                            <div
                                                className="absolute inset-0 bg-cover bg-center"
                                                style={{ backgroundImage: `url(${preset.url})` }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            <span className="relative z-10 text-[10px] font-bold text-white truncate">
                                                {preset.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={tierPictureUrl}
                                        onChange={e => setTierPictureUrl(e.target.value)}
                                        placeholder="https://... image URL for membership card picture"
                                        className="flex-1 px-4 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                    />
                                    <label className="cursor-pointer px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload Image
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    if (typeof reader.result === 'string') {
                                                        setTierPictureUrl(reader.result);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Row 3: Duration & Pricing & VAT */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                {/* Duration */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Duration *
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={tierDurationVal}
                                            onChange={e => setTierDurationVal(Number(e.target.value))}
                                            className="w-20 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                        />
                                        <select
                                            value={tierDurationUnit}
                                            onChange={e => setTierDurationUnit(e.target.value as any)}
                                            className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-medium"
                                        >
                                            <option value="days">Days</option>
                                            <option value="months">Months</option>
                                            <option value="years">Years</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-1 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setTierDurationVal(1); setTierDurationUnit('months'); }}
                                            className="text-[10px] bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-0.5 rounded font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                                        >
                                            1 Month
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setTierDurationVal(6); setTierDurationUnit('months'); }}
                                            className="text-[10px] bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-0.5 rounded font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                                        >
                                            6 Months
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setTierDurationVal(1); setTierDurationUnit('years'); }}
                                            className="text-[10px] bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-0.5 rounded font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                                        >
                                            1 Year
                                        </button>
                                    </div>
                                </div>

                                {/* Price (Base) */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Base Price (AED) *
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tierPrice}
                                        onChange={e => setTierPrice(Number(e.target.value))}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-bold text-indigo-600 dark:text-indigo-400"
                                    />
                                    <span className="text-[11px] text-gray-400 mt-1 block">Price before VAT</span>
                                </div>

                                {/* VAT */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        VAT Rate (%) *
                                    </label>
                                    <select
                                        value={tierVatRate}
                                        onChange={e => setTierVatRate(Number(e.target.value))}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-semibold"
                                    >
                                        <option value={5}>5% (UAE Standard)</option>
                                        <option value={0}>0% (Tax Exempt)</option>
                                        <option value={10}>10% (Special Rate)</option>
                                    </select>
                                    <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 p-2 rounded-lg">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">VAT Amount:</span>
                                            <span className="font-bold text-amber-700 dark:text-amber-400">AED {computedVatAmount}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-amber-200/50 pt-1 mt-1 font-bold">
                                            <span>Total (inc. VAT):</span>
                                            <span className="text-indigo-600 dark:text-indigo-400">AED {computedTotalPrice}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 4: Procedures Allowed in the Membership */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5 bg-white dark:bg-gray-800/60">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                                    Procedures Allowed in Membership
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    Add the clinic services and procedures covered under this membership pass.
                                </p>

                                {/* Procedure selector bar */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-700/40 p-3.5 rounded-xl mb-4 items-end">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase mb-1">
                                            Select Procedure / Service
                                        </label>
                                        <select
                                            value={selectedServiceId}
                                            onChange={e => setSelectedServiceId(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                        >
                                            <option value="">-- Choose Clinic Procedure --</option>
                                            {services.map(svc => (
                                                <option key={svc.id} value={svc.id}>
                                                    {svc.name} ({svc.deptName}) {svc.price ? `— AED ${svc.price}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase">
                                                Sessions Allowed
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={procedureIsUnlimited}
                                                    onChange={e => setProcedureIsUnlimited(e.target.checked)}
                                                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                                                />
                                                <span className="text-[10px] text-indigo-600 font-bold">Unlimited</span>
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            disabled={procedureIsUnlimited}
                                            value={procedureSessionLimit}
                                            onChange={e => setProcedureSessionLimit(Number(e.target.value))}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs disabled:opacity-40"
                                            placeholder={procedureIsUnlimited ? 'Unlimited' : 'e.g. 4'}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddProcedure}
                                        disabled={!selectedServiceId}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Add Procedure
                                    </button>
                                </div>

                                {/* List of Added Procedures */}
                                {tierProcedures.length > 0 ? (
                                    <div className="space-y-2">
                                        {tierProcedures.map((proc, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600 text-xs"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <span className="font-bold text-gray-900 dark:text-white block">
                                                            {proc.serviceName}
                                                        </span>
                                                        <span className="text-[11px] text-gray-500">
                                                            {proc.deptName || 'Specialist Care'} {proc.notes ? `• ${proc.notes}` : ''}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-full">
                                                        {proc.sessionLimit === -1 ? 'Unlimited Sessions' : `${proc.sessionLimit} Sessions`}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProcedure(proc.serviceId)}
                                                        className="text-gray-400 hover:text-red-500 p-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-4 text-xs text-gray-400 italic">
                                        No procedures assigned yet. Select from the dropdown above to add procedures.
                                    </p>
                                )}
                            </div>

                            {/* Row 5: Privileges & Perks */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5 bg-white dark:bg-gray-800/60">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Privileges & VIP Perks
                                </h4>
                                <p className="text-xs text-gray-500 mb-3">
                                    Special benefits, discounts, valet, and priority access granted to members of this tier.
                                </p>

                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newPrivilegeInput}
                                        onChange={e => setNewPrivilegeInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddPrivilege();
                                            }
                                        }}
                                        placeholder="e.g. Free Valet Parking, 15% off additional skincare, Priority Booking"
                                        className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPrivilege}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                                    >
                                        Add Privilege
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                    {tierPrivileges.map((priv, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 text-xs text-gray-800 dark:text-gray-200"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                {priv}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePrivilege(idx)}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit & Cancel */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateTierModal(false)}
                                    className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-7 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-600/30 transition-all"
                                >
                                    {editingTier ? 'Update Membership Plan' : 'Save Membership Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL: ENROLL CLIENT IN MEMBERSHIP
               ══════════════════════════════════════════════════════════ */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white/20">
                                    <Award className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Enroll Client in Membership</h3>
                                    <p className="text-xs text-indigo-100">
                                        Assign membership tier, track payment, and generate VAT invoice
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {assignFeedback && (
                            <div
                                className={`m-6 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                                    assignFeedback.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                            >
                                {assignFeedback.type === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                                {assignFeedback.message}
                            </div>
                        )}

                        <form onSubmit={handleAssignMembership} className="p-6 space-y-4">
                            {/* Select Membership Tier */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Select Membership Plan *
                                </label>
                                <select
                                    required
                                    value={assignTierId}
                                    onChange={e => setAssignTierId(e.target.value)}
                                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-semibold"
                                >
                                    <option value="">-- Choose Membership Tier --</option>
                                    {tiers.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.durationValue} {t.durationUnit}) — AED {t.totalPrice} (inc. {t.vatRate}% VAT)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Selected Tier Preview Pill */}
                            {(() => {
                                const st = tiers.find(t => t.id === assignTierId);
                                if (!st) return null;
                                return (
                                    <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-800/40 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Duration:</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{st.durationValue} {st.durationUnit}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Base Price:</span>
                                            <span className="font-medium text-gray-900 dark:text-white">AED {st.price}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">VAT ({st.vatRate}%):</span>
                                            <span className="font-medium text-amber-600">AED {st.vatAmount}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-indigo-200/50 pt-1 font-bold">
                                            <span className="text-indigo-900 dark:text-indigo-300">Total Payable:</span>
                                            <span className="text-indigo-700 dark:text-indigo-400 text-sm">AED {st.totalPrice}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Client Information */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Customer Full Name *
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        placeholder="e.g. Fatima Al Mansoori"
                                        className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                        Phone Number *
                                    </label>
                                    <input
                                        required
                                        type="tel"
                                        value={clientPhone}
                                        onChange={e => setClientPhone(e.target.value)}
                                        placeholder="+971 50 123 4567"
                                        className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Email Address (optional)
                                </label>
                                <input
                                    type="email"
                                    value={clientEmail}
                                    onChange={e => setClientEmail(e.target.value)}
                                    placeholder="client@fmc.ae"
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            {/* Start Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Membership Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            {/* Payment Method & Status */}
                            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Payment Method *
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value as any)}
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-semibold"
                                >
                                    <option value="card">💳 Credit / Debit Card</option>
                                    <option value="cash">💵 Cash at Reception</option>
                                    <option value="bank_transfer">🏦 Bank Transfer</option>
                                    <option value="online">🌐 Online Payment Link</option>
                                </select>

                                <div className="mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={paymentConfirmed}
                                            onChange={e => setPaymentConfirmed(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 rounded"
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                            Payment received & verified (marks invoice as Paid)
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                                    Internal Notes
                                </label>
                                <input
                                    type="text"
                                    value={assignNotes}
                                    onChange={e => setAssignNotes(e.target.value)}
                                    placeholder="Optional VIP notes or referral remarks"
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAssigning}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isAssigning ? 'Processing...' : 'Assign & Generate VAT Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL: RECORD PROCEDURE USAGE SESSION
               ══════════════════════════════════════════════════════════ */}
            {redeemModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="p-5 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-lg">Record Procedure Session</h4>
                                <p className="text-xs text-indigo-200">Redeem 1 session under membership</p>
                            </div>
                            <button
                                onClick={() => setRedeemModal(prev => ({ ...prev, open: false }))}
                                className="text-white/80 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmRedeem} className="p-6 space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs space-y-1">
                                <div className="font-bold text-sm text-gray-900 dark:text-white">
                                    {redeemModal.serviceName}
                                </div>
                                <div className="text-gray-500">
                                    Client: <span className="font-semibold text-gray-800 dark:text-gray-200">{redeemModal.membership?.customerName}</span>
                                </div>
                                <div className="text-gray-500">
                                    Membership: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{redeemModal.membership?.membershipName}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                                    Doctor / Clinician Name
                                </label>
                                <input
                                    type="text"
                                    value={redeemModal.doctorName}
                                    onChange={e => setRedeemModal(prev => ({ ...prev, doctorName: e.target.value }))}
                                    placeholder="e.g. Dr. Sarah Al Shehhi"
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                                    Clinic Branch
                                </label>
                                <input
                                    type="text"
                                    value={redeemModal.clinicName}
                                    onChange={e => setRedeemModal(prev => ({ ...prev, clinicName: e.target.value }))}
                                    placeholder="First Medical Center LLC"
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                                    Session Notes (optional)
                                </label>
                                <input
                                    type="text"
                                    value={redeemModal.notes}
                                    onChange={e => setRedeemModal(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="e.g. Session 2 completed smoothly"
                                    className="w-full px-3.5 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setRedeemModal(prev => ({ ...prev, open: false }))}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={redeemModal.submitting}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    {redeemModal.submitting ? 'Recording...' : 'Confirm Redemption'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                DRAWER / MODAL: USAGE HISTORY LOG
               ══════════════════════════════════════════════════════════ */}
            {selectedMembershipForHistory && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-lg">Procedure Usage History</h4>
                                <p className="text-xs text-indigo-200">
                                    {selectedMembershipForHistory.customerName} — {selectedMembershipForHistory.membershipName}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedMembershipForHistory(null)}
                                className="text-white/80 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                            {selectedMembershipForHistory.usageHistory && selectedMembershipForHistory.usageHistory.length > 0 ? (
                                selectedMembershipForHistory.usageHistory.map((rec, i) => (
                                    <div
                                        key={i}
                                        className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 text-xs space-y-1"
                                    >
                                        <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm">
                                            <span>{rec.serviceName}</span>
                                            <span className="text-xs font-normal text-gray-400">
                                                {new Date(rec.date).toLocaleDateString()} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-gray-500">
                                            Doctor: <span className="font-semibold text-gray-700 dark:text-gray-300">{rec.doctorName || 'Attending Physician'}</span>
                                        </div>
                                        {rec.notes && (
                                            <div className="text-indigo-600 dark:text-indigo-400 italic">
                                                &quot;{rec.notes}&quot;
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-400 pt-1">
                                            Logged by {rec.recordedBy}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-8 text-xs text-gray-400 italic">
                                    No sessions have been redeemed under this membership yet.
                                </p>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <button
                                onClick={() => setSelectedMembershipForHistory(null)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
