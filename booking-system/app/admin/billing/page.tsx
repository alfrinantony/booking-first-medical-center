'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, InvoiceLineItem } from '@/lib/billing-store';
import { BookingsStore } from '@/lib/bookings-store';
import { Booking, Clinic, Medicine, InventoryBatch } from '@/lib/data';
import { Receipt, Search, Plus, FileText, Printer, Calendar, Clock, User, MapPin, Package, AlertTriangle } from 'lucide-react';

export default function BillingPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchPhone, setSearchPhone] = useState('');
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

    // Bookings data
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [bookingSearch, setBookingSearch] = useState('');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showBookingDropdown, setShowBookingDropdown] = useState(false);

    // Inventory data for batch selection
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [batchesMap, setBatchesMap] = useState<Record<string, InventoryBatch[]>>({});

    // Create Invoice Form
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [invoiceCategory, setInvoiceCategory] = useState('clinic_single');
    const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number; regularPrice?: number; discountAmount?: number; maxDiscountPercentage?: number; medicineId?: string; batchId?: string; consumptions?: { medicineId: string; batchId?: string; quantity: number }[] }[]>([{ description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }]);
    const [packageDetails, setPackageDetails] = useState('');
    const [taxPercentage, setTaxPercentage] = useState(5);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('card');
    const [clinicName, setClinicName] = useState('');
    const [generatedBy, setGeneratedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');
    const [doctorName, setDoctorName] = useState('');

    const loadInvoices = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/billing');
            if (res.ok) {
                const data = await res.json();
                setInvoices(data || []);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        loadInvoices();
        fetch('/api/admin/bookings').then(res => res.json()).then(data => setBookings(Array.isArray(data) ? data : [])).catch(() => {});
        fetch('/api/admin/clinics').then(res => res.json()).then(data => setClinics(data || [])).catch(() => { });
        fetch('/api/admin/medicines').then(res => res.json()).then(data => setMedicines(Array.isArray(data) ? data : [])).catch(() => {});
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            const user = JSON.parse(stored);
            setGeneratedBy(user.name || '');
        }
    }, [loadInvoices]);

    // Intercept ?bookId payload from Appointments Dashboard to support older bookings
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const bookId = new URLSearchParams(window.location.search).get('bookId');
        if (bookId && bookings.length > 0 && clinics.length > 0 && !selectedBooking) {
            const match = bookings.find(b => b.id === bookId);
            if (match) {
                // Pre-fill the model using exactly the same logic
                handleSelectBooking(match);
                setIsCreateModalOpen(true);
                // Wipe the query parameter so it doesn't trigger unexpectedly on refresh
                window.history.replaceState({}, '', '/admin/billing');
            }
        }
    }, [bookings, clinics, selectedBooking]);

    // Fetch active batches when a medicine is selected
    const fetchBatchesForMedicine = async (medicineId: string) => {
        if (batchesMap[medicineId]) return;
        try {
            const res = await fetch(`/api/admin/inventory-batches?medicineId=${medicineId}&active=true`);
            const data = await res.json();
            setBatchesMap(prev => ({ ...prev, [medicineId]: Array.isArray(data) ? data : [] }));
        } catch { /* silent */ }
    };

    // Resolve names from IDs
    const resolveNames = (booking: Booking) => {
        let svcName = booking.serviceId || '';
        let docName = booking.doctorId || '';
        let clnName = booking.clinicId || '';
        let svcPrice = 0;
        let matchedService: any = null;

        for (const clinic of clinics) {
            if (clinic.id === booking.clinicId) {
                clnName = clinic.name;
            }
            for (const dept of clinic.departments) {
                const svc = dept.services.find(s => s.id === booking.serviceId);
                if (svc) {
                    svcName = svc.name;
                    svcPrice = svc.price || 0;
                    matchedService = svc;
                }
                const doc = dept.doctors.find(d => d.id === booking.doctorId);
                if (doc) docName = doc.name;
            }
        }
        
        // Fallback to extract the human-readable name from raw ID if service no longer exists
        if (svcName === booking.serviceId && svcName.includes('-svc-')) {
            const parts = svcName.split('-svc-');
            if (parts.length === 2 && parts[0].includes('-')) {
                const prefixParts = parts[0].split('-');
                if (prefixParts.length >= 2) {
                    svcName = prefixParts.slice(1).join('-');
                }
            }
        }

        return { svcName, docName, clnName, svcPrice, matchedService };
    };

    const filteredBookings = bookingSearch.length >= 1
        ? bookings.filter(b =>
            b.patientName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
            b.id.toLowerCase().includes(bookingSearch.toLowerCase()) ||
            (b.whatsappNumber || '').includes(bookingSearch) ||
            (b.email || '').toLowerCase().includes(bookingSearch.toLowerCase())
        ).slice(0, 10)
        : bookings.slice(0, 10);

    const handleSelectBooking = (booking: Booking) => {
        setSelectedBooking(booking);
        setBookingSearch('');
        setShowBookingDropdown(false);

        const { svcName, docName, clnName, svcPrice, matchedService } = resolveNames(booking);

        // Auto-fill all fields
        setClientName(booking.patientName || '');
        setClientPhone(booking.whatsappNumber || '');
        setClientEmail(booking.email || '');
        
        let finalRegPrice = svcPrice;
        let finalUnitPriceInc = svcPrice;

        if (matchedService) {
            finalRegPrice = matchedService.regularPrice || matchedService.price || 0;
            finalUnitPriceInc = matchedService.discountedPrice !== undefined ? matchedService.discountedPrice : finalRegPrice;
        }

        // If the booking itself has a recorded amount different than our base price
        const bookingAmount = (booking as any).amount;
        if (typeof bookingAmount === 'number' && bookingAmount > 0) {
            finalUnitPriceInc = bookingAmount;
            finalRegPrice = finalRegPrice > finalUnitPriceInc ? finalRegPrice : finalUnitPriceInc;
        }

        const finalDiscAmount = finalRegPrice - finalUnitPriceInc;

        setItems([{
            description: svcName,
            quantity: 1,
            unitPrice: finalUnitPriceInc,
            regularPrice: finalRegPrice,
            discountAmount: finalDiscAmount,
            maxDiscountPercentage: matchedService?.maxDiscountPercentage || 0,
            consumptions: []
        }]);
        setClinicName(clnName);
        setDoctorName(docName);
        setBookingDate(booking.date || '');
        setBookingTime(booking.slot || '');
        setNotes(`Booking ID: ${booking.id} | Doctor: ${docName} | Date: ${booking.date} | Time: ${booking.slot}`);
    };

    const vatFactor = 1 + (taxPercentage / 100);
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const subtotal = totalAmount / vatFactor;
    const taxAmount = totalAmount - subtotal;
    
    const grossTotal = items.reduce((sum, item) => sum + ((item.regularPrice !== undefined ? item.regularPrice : item.unitPrice) * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + ((item.discountAmount || 0) * item.quantity), 0);

    const filtered = searchPhone ? invoices.filter(i => i.clientPhone.includes(searchPhone)) : invoices;

    const resetForm = () => {
        setClientName(''); setClientPhone(''); setClientEmail('');
        setItems([{ description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }]);
        setPackageDetails(''); setNotes(''); setSelectedBooking(null); setBookingSearch('');
        setDoctorName(''); setBookingDate(''); setBookingTime('');
    };

    // Validate batch selections before submission
    const validateBatches = () => {
        const errors: string[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const consArray = item.consumptions || [];
            
            for (let c = 0; c < consArray.length; c++) {
                const cons = consArray[c];
                if (cons.batchId && cons.medicineId) {
                    const batches = batchesMap[cons.medicineId] || [];
                    const batch = batches.find(b => b.id === cons.batchId);
                    if (!batch) {
                        errors.push(`Item ${i + 1} (Resource ${c + 1}): Selected batch not found`);
                    } else {
                        if (batch.expiryDate && new Date(batch.expiryDate) < new Date()) {
                            errors.push(`Item ${i + 1} (Resource ${c + 1}): Batch ${batch.batchNumber} is expired`);
                        }
                        const totalNeeded = cons.quantity * item.quantity;
                        if (batch.quantity < totalNeeded) {
                            errors.push(`Item ${i + 1} (Resource ${c + 1}): ${batch.batchNumber} has ${batch.quantity} units (need ${totalNeeded})`);
                        }
                    }
                }
            }
        }
        return errors;
    };

    const handleCreateInvoice = async () => {
        if (!clientName || !clientPhone || !generatedBy) return;

        const invoiceItems: InvoiceLineItem[] = items.filter(i => i.description).map(i => {
            return {
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                regularPrice: i.regularPrice !== undefined ? i.regularPrice : i.unitPrice,
                discountAmount: i.discountAmount || 0,
                total: i.quantity * i.unitPrice,
                consumptions: i.consumptions || [],
                packagePayload: (i as any).packagePayload
            };
        });

        // Validate batch selections
        const batchErrors = validateBatches();
        if (batchErrors.length > 0) {
            alert('Batch errors:\n' + batchErrors.join('\n'));
            return;
        }

        // Validate max discounts using pure inclusive comparison mapped from catalog configurations
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.maxDiscountPercentage !== undefined && item.regularPrice && item.discountAmount) {
                const maxAllowedInclusiveDiscount = item.regularPrice * (item.maxDiscountPercentage / 100);
                
                if (item.discountAmount > maxAllowedInclusiveDiscount + 0.01) {
                    alert(`Item ${i + 1} discount exceeds maximum allowed of ${item.maxDiscountPercentage}%. Max allowed discount is ${maxAllowedInclusiveDiscount.toFixed(2)} AED.`);
                    return;
                }
            }
        }

        try {
            const res = await fetch('/api/admin/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceCategory,
                    clientName,
                    clientPhone,
                    clientEmail: clientEmail || undefined,
                    items: invoiceItems,
                    packageDetails: packageDetails || undefined,
                    subtotal,
                    taxPercentage,
                    taxAmount,
                    totalAmount,
                    paymentMethod,
                    paymentConfirmed: true,
                    clinicName: clinicName || undefined,
                    generatedBy,
                    date: new Date().toISOString().split('T')[0],
                    notes: notes || undefined
                }),
            });
            if (res.ok) {
                await loadInvoices();
                // Mark the booking as billed
                if (selectedBooking) {
                    try {
                        await fetch(`/api/bookings/${selectedBooking.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ billingStatus: 'billed' })
                        });
                        // Refresh bookings list
                        fetch('/api/admin/bookings').then(res => res.json()).then(data => setBookings(Array.isArray(data) ? data : [])).catch(() => {});
                    } catch { /* silent */ }
                }
            }
        } catch { /* silent */ }

        resetForm();
        setIsCreateModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <datalist id="services-list">
                {Array.from(new Map(clinics.filter(c => clinicName ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.name}>{s.price} AED</option>
                ))}
            </datalist>
            <datalist id="packages-list">
                {Array.from(new Set(clinics.filter(c => clinicName ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).flatMap(s => { const pkgs = []; if (s.threeSessionPackage) pkgs.push(`3 Sessions - ${s.name}`); if (s.sixSessionPackage) pkgs.push(`6 Sessions - ${s.name}`); return pkgs; }))).sort().map((pkg, i) => (
                    <option key={i} value={pkg} />
                ))}
            </datalist>

            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Receipt className="w-8 h-8 text-indigo-600" />
                            Billing & Invoices
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Generate bills from bookings and manage invoices.</p>
                    </div>
                    <button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> Generate Invoice
                    </button>
                </header>

                {/* Pending Bills Alert */}
                {(() => {
                    const pendingBills = bookings.filter(b => b.status === 'completed' && b.billingStatus === 'pending_bill');
                    if (pendingBills.length === 0) return null;
                    return (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 mb-6 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-amber-800 dark:text-amber-300">{pendingBills.length} Completed Procedure{pendingBills.length > 1 ? 's' : ''} Pending Billing</div>
                                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">The following bookings have been marked as completed but no invoice has been generated yet:</p>
                                <div className="mt-2 space-y-1">
                                    {pendingBills.slice(0, 5).map(b => (
                                        <div key={b.id} className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                            <span className="font-medium">{b.patientName}</span>
                                            <span className="text-amber-600 dark:text-amber-500">·</span>
                                            <span>{b.date} {b.slot}</span>
                                            <button onClick={() => { handleSelectBooking(b); setIsCreateModalOpen(true); }} className="ml-auto text-xs bg-amber-600 text-white px-2 py-0.5 rounded hover:bg-amber-700 transition-colors">Generate Bill</button>
                                        </div>
                                    ))}
                                    {pendingBills.length > 5 && <div className="text-xs text-amber-600">... and {pendingBills.length - 5} more</div>}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Search */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6 border border-gray-100 dark:border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Search by client phone..." className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
                    </div>
                </div>

                {/* Invoice List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No invoices found.</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(inv => (
                                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors" onClick={() => setViewingInvoice(inv)}>
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white">{inv.invoiceNumber}</div>
                                        <div className="text-sm text-gray-500">{inv.clientName} · {inv.clientPhone}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-indigo-600">{inv.totalAmount.toFixed(2)} AED</div>
                                        <div className="text-xs text-gray-500">{inv.date} · {inv.paymentMethod}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Create Invoice Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5" /> Generate Invoice</h2>
                            <div className="space-y-4">

                                {/* Client Details Auto-fill */}
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                                    <label className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">🔍 Search & Auto-fill Client Details</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-indigo-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by patient name, phone, or booking ID..."
                                            className="w-full pl-10 p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-gray-700 text-sm"
                                            value={selectedBooking ? `${selectedBooking.patientName} — ${selectedBooking.date} ${selectedBooking.slot}` : bookingSearch}
                                            onChange={e => { setBookingSearch(e.target.value); setSelectedBooking(null); setShowBookingDropdown(true); }}
                                            onFocus={() => setShowBookingDropdown(true)}
                                        />
                                        {showBookingDropdown && !selectedBooking && (
                                            <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {filteredBookings.length === 0 ? (
                                                    <div className="p-3 text-sm text-gray-500">No bookings found.</div>
                                                ) : (
                                                    filteredBookings.map(b => {
                                                        const { svcName, docName, clnName } = resolveNames(b);
                                                        return (
                                                            <button key={b.id} type="button"
                                                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                                                                onClick={() => {
                                                                    setClientName(b.patientName || '');
                                                                    setClientPhone(b.whatsappNumber || '');
                                                                    setClientEmail(b.email || '');
                                                                    setBookingSearch('');
                                                                    setShowBookingDropdown(false);
                                                                }}>
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="font-medium text-sm text-gray-900 dark:text-white">{b.patientName}</div>
                                                                        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                                                                            <span>📱 {b.whatsappNumber || '—'}</span>
                                                                            <span>💊 {svcName}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{b.date}</div>
                                                                        <div className="text-xs text-gray-500">{b.slot} · {clnName}</div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {selectedBooking && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-xs text-green-700 dark:text-green-400 font-medium">✓ Client details filled.</span>
                                            <button type="button" onClick={() => { setSelectedBooking(null); resetForm(); }} className="text-xs text-indigo-600 underline">Clear</button>
                                        </div>
                                    )}
                                </div>

                                {/* Client Info */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Client Name *</label>
                                        <input type="text" required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Client Phone *</label>
                                        <input type="tel" required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Client Email</label>
                                        <input type="email" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                                    </div>
                                </div>

                                {/* Booking Info */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Booking Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time Slot</label>
                                        <input type="text" placeholder="e.g. 10:00 AM" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Doctor / Technician</label>
                                        <input type="text" placeholder="Doctor name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Services / Items</label>
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 mb-2">
                                            <input 
                                                list="services-list" 
                                                type="text" 
                                                placeholder="Service name (type to search)" 
                                                className="flex-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                                                value={item.description} 
                                                onChange={(e) => { 
                                                    const val = e.target.value;
                                                    const u = [...items]; 
                                                    u[idx] = { ...u[idx], description: val };
                                                    if (val) {
                                                        let matchedService = null;
                                                        let matchedClinic = null;
                                                        for(const c of clinics) {
                                                            if (clinicName && c.name !== clinicName) continue;
                                                            for(const d of c.departments) {
                                                                const hit = d.services.find(s => s.name === val);
                                                                if(hit) { matchedService = hit; matchedClinic = c; break; }
                                                            }
                                                            if (matchedService) break;
                                                        }
                                                        if (matchedService && (u[idx].unitPrice === 0 || u[idx].regularPrice === 0)) {
                                                            const svcReg = matchedService.regularPrice || matchedService.price || 0;
                                                            const svcFinalInc = matchedService.discountedPrice !== undefined ? matchedService.discountedPrice : svcReg;

                                                            u[idx].regularPrice = svcReg;
                                                            u[idx].maxDiscountPercentage = matchedService.maxDiscountPercentage || 0;
                                                            u[idx].unitPrice = svcFinalInc;
                                                            u[idx].discountAmount = svcReg - svcFinalInc;
                                                            
                                                            if (!clinicName && matchedClinic) {
                                                                setClinicName(matchedClinic.name);
                                                            }
                                                        }
                                                    }
                                                    setItems(u); 
                                                }} 
                                            />
                                            <input type="number" min="1" placeholder="Qty" className="w-16 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm flex-shrink-0" value={item.quantity} onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], quantity: Number(e.target.value) }; setItems(u); }} />
                                            <input type="number" min="0" placeholder="Reg.Price" className="w-24 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm flex-shrink-0"
                                                value={item.regularPrice !== undefined ? item.regularPrice : item.unitPrice || ''} 
                                                onChange={(e) => { 
                                                    const u = [...items]; 
                                                    u[idx].regularPrice = Number(e.target.value); 
                                                    u[idx].unitPrice = u[idx].regularPrice! - (u[idx].discountAmount || 0); 
                                                    setItems(u); 
                                                }} />
                                            <input type="number" min="0" placeholder="Discount" className="w-24 p-2 border border-green-300 dark:border-green-700 rounded-md dark:bg-gray-700 text-sm flex-shrink-0"
                                                value={item.discountAmount !== undefined && item.discountAmount !== 0 ? item.discountAmount : ''} 
                                                onChange={(e) => { 
                                                    const u = [...items]; 
                                                    u[idx].discountAmount = Number(e.target.value); 
                                                    u[idx].unitPrice = (u[idx].regularPrice || 0) - u[idx].discountAmount; 
                                                    setItems(u); 
                                                }} />
                                            <div className="w-20 px-2 py-2 text-sm text-right bg-gray-50 dark:bg-gray-800 border rounded-md dark:border-gray-600 self-center flex-shrink-0">
                                                {item.unitPrice.toFixed(2)}
                                            </div>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 px-2">✕</button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }])} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Item</button>
                                </div>

                                {/* Inventory Consumption Multi-Matrix */}
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-3">
                                    <label className="block text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                        <Package className="w-4 h-4" /> Multi-Item Resource Tracker
                                    </label>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Link multiple consumable units or boxes directly to a single invoice line item.</p>
                                    {items.map((item, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-md p-3 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                                            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-700">
                                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Item {idx + 1}: {item.description || '(no description)'} <span className="text-gray-400">(Qty: {item.quantity})</span></div>
                                                <button type="button" onClick={() => {
                                                    const u = [...items];
                                                    u[idx] = { ...item, consumptions: [...(item.consumptions || []), { medicineId: '', quantity: 1 }] };
                                                    setItems(u);
                                                }} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 uppercase tracking-wider bg-emerald-100/50 dark:bg-emerald-900/50 px-2 py-1 rounded">+ Add Resource Option</button>
                                            </div>

                                            <div className="space-y-3 pt-1">
                                                {(item.consumptions || []).length === 0 && (
                                                    <div className="text-[10px] text-gray-500 italic py-1">No resources linked to this service automatically.</div>
                                                )}
                                                {(item.consumptions || []).map((cons, cIdx) => (
                                                    <div key={cIdx} className="relative pl-4 border-l-2 border-emerald-200 dark:border-emerald-700 mb-2">
                                                        <button type="button" onClick={() => {
                                                            const u = [...items];
                                                            u[idx].consumptions = u[idx].consumptions!.filter((_, i) => i !== cIdx);
                                                            setItems(u);
                                                        }} className="absolute -left-[9px] top-1.5 bg-white dark:bg-gray-800 text-red-400 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow border border-red-100 dark:border-red-900/50">✕</button>

                                                        <div className="grid grid-cols-12 gap-2 mt-1">
                                                            <div className="col-span-6 md:col-span-5">
                                                                <label className="block text-[9px] uppercase tracking-wider font-medium text-gray-500 mb-0.5">Medicine/Consumable</label>
                                                                <select className="w-full p-1.5 border rounded text-[10px] bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:outline-none"
                                                                    value={cons.medicineId || ''}
                                                                    onChange={e => {
                                                                        const u = [...items];
                                                                        u[idx].consumptions![cIdx] = { ...cons, medicineId: e.target.value, batchId: undefined };
                                                                        setItems(u);
                                                                        if (e.target.value) fetchBatchesForMedicine(e.target.value);
                                                                    }}>
                                                                    <option value="">— Select Matrix —</option>
                                                                    {medicines.map(m => (
                                                                        <option key={m.id} value={m.id}>{m.name} (Stock: {m.centralStock})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="col-span-6 md:col-span-5">
                                                                <label className="block text-[9px] uppercase tracking-wider font-medium text-gray-500 mb-0.5">Physical Batch (Lot)</label>
                                                                <select className="w-full p-1.5 border rounded text-[10px] bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:outline-none"
                                                                    value={cons.batchId || ''}
                                                                    disabled={!cons.medicineId}
                                                                    onChange={e => {
                                                                        const u = [...items];
                                                                        u[idx].consumptions![cIdx] = { ...cons, batchId: e.target.value || undefined };
                                                                        setItems(u);
                                                                    }}>
                                                                    <option value="">— Select physical lot —</option>
                                                                    {(batchesMap[cons.medicineId] || []).map(b => {
                                                                        const isExp = b.expiryDate && new Date(b.expiryDate) < new Date();
                                                                        return (
                                                                            <option key={b.id} value={b.id} disabled={!!isExp || b.quantity <= 0}>
                                                                                {b.batchNumber} (Qty: {b.quantity})
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            </div>
                                                            <div className="col-span-12 md:col-span-2">
                                                                <label className="block text-[9px] uppercase tracking-wider font-medium text-gray-500 mb-0.5">Burn Qty</label>
                                                                <input type="number" min="1" className="w-full p-1.5 border rounded text-[10px] bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:outline-none"
                                                                    value={cons.quantity}
                                                                    onChange={e => {
                                                                        const u = [...items];
                                                                        u[idx].consumptions![cIdx] = { ...cons, quantity: Number(e.target.value) };
                                                                        setItems(u);
                                                                    }} />
                                                            </div>
                                                        </div>
                                                        
                                                        {cons.batchId && (() => {
                                                            const batch = (batchesMap[cons.medicineId] || []).find(b => b.id === cons.batchId);
                                                            if (!batch) return null;
                                                            const isExp = batch.expiryDate && new Date(batch.expiryDate) < new Date();
                                                            const totalNeeded = cons.quantity * item.quantity;
                                                            const insufficient = batch.quantity < totalNeeded;
                                                            if (isExp || insufficient) {
                                                                return (
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 mt-1.5 bg-red-50 dark:bg-red-900/20 p-1.5 rounded border border-red-100 dark:border-red-900/50">
                                                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                                        {isExp ? 'This physical lot has EXPIRED!' : `Needs ${totalNeeded} units total (${cons.quantity} × ${item.quantity} services). Only ${batch.quantity} available!`}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 mt-1.5">
                                                                    ✓ {batch.quantity} raw units available · Processing a {totalNeeded}-unit deduction
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Package (if applicable)</label>
                                        <input type="text" list="packages-list" placeholder="Search or type Package name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={packageDetails} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPackageDetails(val);
                                                
                                                if (val) {
                                                    let pkgMatch = null;
                                                    let matchedClinicName = null;
                                                    let matchedSvc: any = null;
                                                    let sessionCount = 3;
                                                    
                                                    for(const c of clinics) {
                                                        for(const d of c.departments) {
                                                            for(const s of d.services) {
                                                                if (val === `3 Sessions - ${s.name}` && s.threeSessionPackage) {
                                                                    pkgMatch = s.threeSessionPackage;
                                                                    matchedClinicName = c.name;
                                                                    matchedSvc = s;
                                                                    sessionCount = 3;
                                                                    break;
                                                                }
                                                                if (val === `6 Sessions - ${s.name}` && s.sixSessionPackage) {
                                                                    pkgMatch = s.sixSessionPackage;
                                                                    matchedClinicName = c.name;
                                                                    matchedSvc = s;
                                                                    sessionCount = 6;
                                                                    break;
                                                                }
                                                            }
                                                            if (pkgMatch) break;
                                                        }
                                                        if (pkgMatch) break;
                                                    }
                                                    
                                                    if (pkgMatch && matchedSvc) {
                                                        const pkgPriceInc = pkgMatch.discountedPrice !== undefined ? pkgMatch.discountedPrice : (pkgMatch.totalCost || 0);
                                                        const pkgReg = pkgMatch.totalCost || pkgPriceInc;
                                                        const u = [...items];
                                                        const desc = pkgMatch.validity ? `${val} (Valid for ${pkgMatch.validity} days)` : val;
                                                        
                                                        const packagePayload = {
                                                            serviceId: matchedSvc.id,
                                                            serviceName: matchedSvc.name,
                                                            sessionCount: sessionCount,
                                                            validity: pkgMatch.validity || 90,
                                                            price: pkgPriceInc
                                                        };

                                                        const newItem = { description: desc, quantity: 1, unitPrice: pkgPriceInc, regularPrice: pkgReg, discountAmount: pkgReg - pkgPriceInc, maxDiscountPercentage: undefined, consumptions: [], packagePayload };
                                                        
                                                        const noteAppend = "Purchased services won't refund, complete the services before the expiry of validity date.";
                                                        setNotes(prev => prev ? (prev.includes(noteAppend) ? prev : prev + '\n' + noteAppend) : noteAppend);

                                                        if (u.length === 1 && !u[0].description && u[0].unitPrice === 0) {
                                                            u[0] = newItem;
                                                        } else {
                                                            u.push(newItem);
                                                        }
                                                        setItems(u);
                                                        setInvoiceCategory("clinic_package");
                                                        if (!clinicName && matchedClinicName) {
                                                            setClinicName(matchedClinicName);
                                                        }
                                                    }
                                                }
                                            }} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">VAT %</label>
                                        <input type="number" min="0" max="100" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={taxPercentage} onChange={(e) => setTaxPercentage(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Document Type *</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={invoiceCategory} onChange={(e) => setInvoiceCategory(e.target.value)}>
                                            <option value="clinic_single">Single Session Invoice (FMC-SIV)</option>
                                            <option value="clinic_package">Package Bill (FMC-PKG)</option>
                                            <option value="package_session">Session billed from Package (FMC-PIV)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Payment Method *</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                                            <option value="cash">Cash</option>
                                            <option value="card">Card</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="online">Online</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Generated By *</label>
                                        <input type="text" required placeholder="Staff name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={generatedBy} onChange={(e) => setGeneratedBy(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Clinic Name</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={clinicName} onChange={(e) => setClinicName(e.target.value)}>
                                            <option value="">— Select branch —</option>
                                            {clinics.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notes</label>
                                        <input type="text" placeholder="Optional notes" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={notes} onChange={(e) => setNotes(e.target.value)} />
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-1 text-sm">
                                    {totalDiscount > 0 && (
                                        <>
                                            <div className="flex justify-between text-gray-500"><span>Gross Total</span><span>{grossTotal.toFixed(2)} AED</span></div>
                                            <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{totalDiscount.toFixed(2)} AED</span></div>
                                        </>
                                    )}
                                    <div className="flex justify-between text-gray-500"><span>Amount (Excluding VAT)</span><span>{subtotal.toFixed(2)} AED</span></div>
                                    <div className="flex justify-between text-gray-500"><span>VAT ({taxPercentage}%)</span><span>{taxAmount.toFixed(2)} AED</span></div>
                                    <div className="flex justify-between font-bold text-lg border-t pt-2 dark:border-gray-600"><span>Total</span><span>{totalAmount.toFixed(2)} AED</span></div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                    <button onClick={handleCreateInvoice} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Invoice</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Invoice Detail Modal */}
                {viewingInvoice && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold">{viewingInvoice.invoiceNumber}</h2>
                                    <p className="text-sm text-gray-500">{viewingInvoice.date}</p>
                                </div>
                                <button onClick={() => setViewingInvoice(null)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <div><span className="text-gray-500">Client:</span> {viewingInvoice.clientName} ({viewingInvoice.clientPhone})</div>
                                {viewingInvoice.clinicName && <div><span className="text-gray-500">Clinic:</span> {viewingInvoice.clinicName}</div>}
                                <div><span className="text-gray-500">Payment:</span> {viewingInvoice.paymentMethod}</div>
                                <div><span className="text-gray-500">Generated by:</span> {viewingInvoice.generatedBy}</div>
                                {viewingInvoice.packageDetails && <div><span className="text-gray-500">Package:</span> {viewingInvoice.packageDetails}</div>}
                            </div>
                            <table className="w-full text-sm mb-4">
                                <thead><tr className="border-b dark:border-gray-700"><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Reg. Price</th><th className="text-right">Disc.</th><th className="text-right">Final Price</th><th className="text-right">Total</th></tr></thead>
                                <tbody>
                                    {viewingInvoice.items.map((item, idx) => (
                                        <tr key={idx} className="border-b dark:border-gray-700">
                                            <td className="py-1 break-words">{item.description}</td>
                                            <td className="text-right tabular-nums">{item.quantity}</td>
                                            <td className="text-right tabular-nums">{(item.regularPrice ?? item.unitPrice).toFixed(2)}</td>
                                            <td className="text-right tabular-nums">{(item.discountAmount ?? 0).toFixed(2)}</td>
                                            <td className="text-right tabular-nums">{item.unitPrice.toFixed(2)}</td>
                                            <td className="text-right tabular-nums">{item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="space-y-1 text-sm">
                                {(() => {
                                    const vGross = viewingInvoice.items.reduce((sum, item) => sum + ((item.regularPrice !== undefined ? item.regularPrice : item.unitPrice) * item.quantity), 0);
                                    const vDisc = viewingInvoice.items.reduce((sum, item) => sum + ((item.discountAmount || 0) * item.quantity), 0);
                                    return (
                                        <>
                                            {vDisc > 0 && (
                                                <>
                                                    <div className="flex justify-between text-gray-500"><span>Gross Total</span><span>{vGross.toFixed(2)} AED</span></div>
                                                    <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{vDisc.toFixed(2)} AED</span></div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                                <div className="flex justify-between text-gray-500"><span>Amount (Excluding VAT)</span><span>{viewingInvoice.subtotal.toFixed(2)} AED</span></div>
                                <div className="flex justify-between text-gray-500"><span>VAT ({viewingInvoice.taxPercentage}%)</span><span>{viewingInvoice.taxAmount.toFixed(2)} AED</span></div>
                                <div className="flex justify-between font-bold text-lg border-t pt-2 dark:border-gray-600"><span>Total</span><span>{viewingInvoice.totalAmount.toFixed(2)} AED</span></div>
                            </div>
                            
                            {viewingInvoice.payments && viewingInvoice.payments.length > 0 && (
                                <div className="mt-4 border-t dark:border-gray-700 pt-4">
                                    <h4 className="font-bold text-sm mb-2 text-gray-700 dark:text-gray-300">Payment References</h4>
                                    <div className="space-y-2">
                                        {viewingInvoice.payments.map((p, idx) => (
                                            <div key={idx} className="flex justify-between flex-wrap items-center text-xs bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                                <div className="flex gap-2 items-center">
                                                    <span className="capitalize font-medium text-gray-900 dark:text-white text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">{p.mode}</span>
                                                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{p.referenceNumber}</span>
                                                </div>
                                                <div className="text-gray-500 text-right">
                                                    <div className="font-medium text-gray-900 dark:text-white">{p.amount.toFixed(2)} AED</div>
                                                    <div style={{fontSize: '9px'}}>{new Date(p.date).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {viewingInvoice.notes && <div className="mt-3 text-xs text-gray-500">Notes: {viewingInvoice.notes}</div>}
                            <div className="mt-4 flex justify-end">
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
