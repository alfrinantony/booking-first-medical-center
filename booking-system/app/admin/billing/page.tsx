'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Invoice, InvoiceLineItem } from '@/lib/billing-store';
import { Booking, Clinic, Medicine, InventoryBatch } from '@/lib/data';
import type { AddonService } from '@/lib/addon-services-store';
import {
    buildServiceConsumptions,
    getBatchAvailableQuantity,
    pickBestBatchForMedicine,
    validateInvoiceStockDeductions
} from '@/lib/billing-inventory-rules';
import { Receipt, Search, Plus, FileText, Printer, Calendar, Clock, User, MapPin, Package, AlertTriangle, CreditCard, Scissors, Zap, RefreshCw, X } from 'lucide-react';

type BillingConsumption = { medicineId: string; batchId?: string; quantity: number };
type BillingItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    regularPrice?: number;
    discountAmount?: number;
    maxDiscountPercentage?: number;
    medicineId?: string;
    batchId?: string;
    consumptions?: BillingConsumption[];
    packagePayload?: any;
    isCustom?: boolean;
};

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
    const [items, setItems] = useState<BillingItem[]>([{ description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }]);
    const [packageDetails, setPackageDetails] = useState('');
    const [taxPercentage, setTaxPercentage] = useState(5);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('card');
    const [clinicId, setClinicId] = useState('');
    const [clinicName, setClinicName] = useState('');
    const [generatedBy, setGeneratedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');
    const [doctorName, setDoctorName] = useState('');
    // Online payment reference (SB invoice number, Stripe ref, etc.) — shown on receipt
    const [onlineReference, setOnlineReference] = useState('');
    // Booking linkage for appInvoiceMap
    const [linkedBookingId, setLinkedBookingId] = useState('');
    const [linkedSbId, setLinkedSbId] = useState('');
    // Duplicate bill protection
    const [submitting, setSubmitting] = useState(false);
    const [alreadyBilledInvoice, setAlreadyBilledInvoice] = useState<{ invoiceNumber: string; id: string } | null>(null);
    const [allowDuplicate, setAllowDuplicate] = useState(false);

    // ── Laser Hair Removal Add-ons (API-driven) ──
    const [addonServices, setAddonServices] = useState<AddonService[]>([]);
    const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set()); // keyed by addon.id
    const [addonPrices, setAddonPrices] = useState<Record<string, number>>({}); // override prices

    /** Returns the FIFO-best batch for a medicine: oldest non-expired with available stock */
    const pickBestBatch = useCallback((medicineId: string): string | undefined => {
        return pickBestBatchForMedicine(batchesMap[medicineId] || [], clinicId || undefined)?.id;
    }, [batchesMap, clinicId]);

    const toggleAddon = useCallback(async (addon: AddonService) => {
        const desc = `[Add-on] ${addon.name}`;
        const isOn = selectedAddons.has(addon.id);
        if (isOn) {
            setItems(prev => prev.filter(i => i.description !== desc));
            setSelectedAddons(prev => { const n = new Set(prev); n.delete(addon.id); return n; });
        } else {
            // Pre-fetch batches for all linked consumables
            const missing = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : []).filter(c => !batchesMap[c.medicineId]);
            if (missing.length > 0) {
                const fetched = await Promise.all(
                    missing.map(async c => {
                        try {
                            const res = await fetch(`/api/admin/inventory-batches?medicineId=${c.medicineId}&active=true`);
                            return { medicineId: c.medicineId, batches: await res.json() as InventoryBatch[] };
                        } catch { return { medicineId: c.medicineId, batches: [] as InventoryBatch[] }; }
                    })
                );
                setBatchesMap(prev => {
                    const next = { ...prev };
                    fetched.forEach(f => { next[f.medicineId] = Array.isArray(f.batches) ? f.batches : []; });
                    return next;
                });
                // After setting state, batches may not be available yet in this closure;
                // we manually build a local map for immediate use
                const localMap: Record<string, InventoryBatch[]> = { ...batchesMap };
                fetched.forEach(f => { localMap[f.medicineId] = Array.isArray(f.batches) ? f.batches : []; });

                // Build consumptions using the fresh localMap
                const consumptions = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : [])
                    .filter(c => c.medicineId)
                    .map(c => {
                        const batch = pickBestBatchForMedicine(localMap[c.medicineId] || [], clinicId || undefined, c.quantityPerService);
                        return { medicineId: c.medicineId, batchId: batch?.id, quantity: c.quantityPerService };
                    });

                const price = Number(addonPrices[addon.id] ?? addon.defaultPrice ?? 0);
                setItems(prev => [...prev, {
                    description: desc, quantity: 1,
                    unitPrice: price, regularPrice: price, discountAmount: 0,
                    maxDiscountPercentage: 0, consumptions,
                }]);
            } else {
                // All batches already cached
                const consumptions = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : [])
                    .filter(c => c.medicineId)
                    .map(c => ({ medicineId: c.medicineId, batchId: pickBestBatch(c.medicineId), quantity: c.quantityPerService }));
                const price = Number(addonPrices[addon.id] ?? addon.defaultPrice ?? 0);
                setItems(prev => [...prev, {
                    description: desc, quantity: 1,
                    unitPrice: price, regularPrice: price, discountAmount: 0,
                    maxDiscountPercentage: 0, consumptions,
                }]);
            }
            setSelectedAddons(prev => { const n = new Set(prev); n.add(addon.id); return n; });
        }
    }, [selectedAddons, batchesMap, addonPrices, pickBestBatch]);

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
        // Load add-on services from API
        fetch('/api/admin/addon-services')
            .then(res => res.json())
            .then(data => {
                const active = (Array.isArray(data) ? data : []).filter((a: AddonService) => a.isActive);
                setAddonServices(active);
                setAddonPrices(Object.fromEntries(active.map((a: AddonService) => [a.id, a.defaultPrice])));
            })
            .catch(() => {});
        const stored = sessionStorage.getItem('adminUser');
        if (stored) {
            const user = JSON.parse(stored);
            setGeneratedBy(user.name || '');
        }
    }, [loadInvoices]);

    // Immediately on mount — read ?sbRef and open the create modal with it pre-filled
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const p = new URLSearchParams(window.location.search);
        const sbRef = p.get('sbRef');
        const sbId  = p.get('sbId');
        if (sbRef) {
            setOnlineReference(sbRef);
            setIsCreateModalOpen(true); // Open form right away
        }
        if (sbId) setLinkedSbId(sbId);
    }, []); // runs once on mount

    // Intercept ?bookId / ?sbRef / ?sbId from Appointments page
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const p = new URLSearchParams(window.location.search);
        const bookId = p.get('bookId');
        const sbRef  = p.get('sbRef');
        const sbId   = p.get('sbId');

        // Pre-fill SB invoice reference immediately (doesn't need bookings to load)
        if (sbRef) setOnlineReference(sbRef);
        if (sbId)  setLinkedSbId(sbId);

        if (bookId && clinics.length > 0 && !selectedBooking) {
            // Try fetching the specific booking directly from the API first
            fetch(`/api/bookings/${bookId}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Booking not found via direct API');
                })
                .then(booking => {
                    if (booking) {
                        handleSelectBooking(booking);
                        setIsCreateModalOpen(true);
                        window.history.replaceState({}, '', '/admin/billing');
                    }
                })
                .catch(err => {
                    console.error('Direct booking fetch failed, falling back to local bookings list:', err);
                    if (bookings.length > 0) {
                        const match = bookings.find(b => b.id === bookId);
                        if (match) {
                            handleSelectBooking(match);
                            setIsCreateModalOpen(true);
                            window.history.replaceState({}, '', '/admin/billing');
                        }
                    }
                });
        }
    }, [bookings, clinics, selectedBooking]);

    // Fetch active batches when a medicine is selected
    const fetchBatchesForMedicine = async (medicineId: string): Promise<InventoryBatch[]> => {
        if (batchesMap[medicineId]) return batchesMap[medicineId];
        try {
            const res = await fetch(`/api/admin/inventory-batches?medicineId=${medicineId}&active=true`);
            const data = await res.json();
            const batches = Array.isArray(data) ? data : [];
            setBatchesMap(prev => ({ ...prev, [medicineId]: batches }));
            return batches;
        } catch {
            return [];
        }
    };

    const loadServiceConsumptions = async (service: any, targetClinicId?: string) => {
        const consumableIds = Array.isArray(service?.consumableIds) ? service.consumableIds.filter(Boolean) : [];
        if (consumableIds.length === 0) return [];

        const localBatchesMap: Record<string, InventoryBatch[]> = { ...batchesMap };
        const missing = consumableIds.filter((medicineId: string) => !localBatchesMap[medicineId]);
        if (missing.length > 0) {
            const fetched = await Promise.all(missing.map(async (medicineId: string) => ({
                medicineId,
                batches: await fetchBatchesForMedicine(medicineId),
            })));
            fetched.forEach(entry => { localBatchesMap[entry.medicineId] = entry.batches; });
        }

        return buildServiceConsumptions(service, localBatchesMap, targetClinicId || clinicId || undefined);
    };

    const hydrateServiceConsumptionsForItem = async (
        service: any,
        itemIndex: number,
        targetClinicId?: string,
        expectedDescription?: string
    ) => {
        const consumptions = await loadServiceConsumptions(service, targetClinicId);
        setItems(prev => prev.map((item, index) => {
            if (index !== itemIndex) return item;
            if (expectedDescription && item.description !== expectedDescription) return item;
            return { ...item, consumptions };
        }));
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
                const svc = dept.services.find(s => 
                    s.id === booking.serviceId || 
                    s.name === booking.serviceName || 
                    (booking.serviceId && s.name.toLowerCase() === booking.serviceId.toLowerCase())
                );
                if (svc) {
                    svcName = svc.name;
                    svcPrice = svc.price || 0;
                    matchedService = svc;
                }
                const doc = dept.doctors.find(d => 
                    d.id === booking.doctorId || 
                    d.name === booking.doctorId || 
                    (booking.doctorId && d.name.toLowerCase() === booking.doctorId.toLowerCase())
                );
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
        const resolvedClinicId = booking.clinicId || clinics.find(c => c.name === clnName)?.id || '';

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
        const sbAmount = (booking as any).sbInvoiceAmount; // For SimplyBook-sourced bookings
        const effectiveAmount = typeof bookingAmount === 'number' && bookingAmount > 0
            ? bookingAmount
            : typeof sbAmount === 'number' && sbAmount > 0
            ? sbAmount
            : null;

        if (effectiveAmount !== null) {
            finalUnitPriceInc = effectiveAmount;
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
            consumptions: matchedService
                ? buildServiceConsumptions(matchedService, batchesMap, resolvedClinicId || undefined)
                : []
        }]);
        if (matchedService) {
            void hydrateServiceConsumptionsForItem(matchedService, 0, resolvedClinicId, svcName);
        }
        setClinicId(resolvedClinicId);
        setClinicName(clnName);
        setDoctorName(docName);
        setBookingDate(booking.date || '');
        setBookingTime(booking.slot || '');

        // Booking linkage — persisted on the invoice for appInvoiceMap
        setLinkedBookingId(booking.id || '');
        const sbIdVal = (booking as any).sbId || '';
        setLinkedSbId(sbIdVal);

        // Duplicate bill detection — check if this booking is already billed
        setAllowDuplicate(false);
        setAlreadyBilledInvoice(null);
        void (async () => {
            const findInvoice = async (query: string) => {
                const existingRes = await fetch(`/api/admin/billing?${query}`);
                if (!existingRes.ok) return null;
                const existingInvoices: Array<{ id: string; invoiceNumber: string }> = await existingRes.json();
                return Array.isArray(existingInvoices) && existingInvoices.length > 0 ? existingInvoices[0] : null;
            };

            try {
                const invoiceByBooking = await findInvoice(`bookingId=${encodeURIComponent(booking.id)}`);
                const invoiceBySbId = !invoiceByBooking && sbIdVal
                    ? await findInvoice(`sbId=${encodeURIComponent(sbIdVal)}`)
                    : null;
                const existingInvoice = invoiceByBooking || invoiceBySbId;
                if (existingInvoice) {
                    setAlreadyBilledInvoice({ id: existingInvoice.id, invoiceNumber: existingInvoice.invoiceNumber });
                } else if ((booking as any).billingStatus === 'billed') {
                    setAlreadyBilledInvoice({ id: '', invoiceNumber: 'a previous invoice' });
                }
            } catch {
                if ((booking as any).billingStatus === 'billed') {
                    setAlreadyBilledInvoice({ id: '', invoiceNumber: 'a previous invoice' });
                }
            }
        })();

        // Auto-set payment method
        const bkPaymentMethod = (booking as any).paymentMethod;
        const sbPaymentStatus = (booking as any).sbPaymentStatus;
        if (bkPaymentMethod === 'online' || bkPaymentMethod === 'card' || sbPaymentStatus === 'paid') {
            setPaymentMethod('online');
        } else if (bkPaymentMethod === 'cash') {
            setPaymentMethod('cash');
        }

        // Pre-fill online reference from SB invoice number (avoid duplicates)
        const sbInvoiceNumber = (booking as any).sbInvoiceNumber;
        const sbInvoiceId = (booking as any).sbInvoiceId;
        if (sbInvoiceNumber) {
            setOnlineReference(sbInvoiceNumber);
        } else if (sbInvoiceId) {
            setOnlineReference(`SB-INV-${sbInvoiceId}`);
        } else {
            setOnlineReference('');
        }

        // Build notes — include SB invoice ref if available
        const sbNote = sbInvoiceNumber ? ` | SB Invoice: ${sbInvoiceNumber}` : (sbInvoiceId ? ` | SimplyBook ID: #${sbInvoiceId}` : '');
        setNotes(`Booking ID: ${booking.id} | Doctor: ${docName} | Date: ${booking.date} | Time: ${booking.slot}${sbNote}`);

    };

    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 1) * Number(item.unitPrice || 0)), 0);
    const taxAmount = subtotal * (taxPercentage / 100);
    const totalAmount = subtotal + taxAmount;
    
    const grossTotal = items.reduce((sum, item) => sum + (Number(item.regularPrice !== undefined ? item.regularPrice : item.unitPrice || 0) * (item.quantity || 1)), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (Number(item.discountAmount || 0) * (item.quantity || 1)), 0);

    const filtered = searchPhone ? invoices.filter(i => i.clientPhone.includes(searchPhone)) : invoices;

    const resetForm = () => {
        setClientName(''); setClientPhone(''); setClientEmail('');
        setItems([{ description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }]);
        setPackageDetails(''); setNotes(''); setSelectedBooking(null); setBookingSearch('');
        setDoctorName(''); setBookingDate(''); setBookingTime('');
        setOnlineReference(''); setLinkedBookingId(''); setLinkedSbId('');
        setAlreadyBilledInvoice(null); setAllowDuplicate(false);
        setSelectedAddons(new Set());
        // Reset prices back to defaults
        setAddonPrices(Object.fromEntries(addonServices.map(a => [a.id, a.defaultPrice])));
    };

    // Validate batch selections before submission
    const validateBatches = () => {
        const allBatches = Object.values(batchesMap).flat();
        return validateInvoiceStockDeductions(items as InvoiceLineItem[], allBatches, clinicId || undefined);
    };

    const handleCreateInvoice = async () => {
        if (!clientName || !clientPhone || !generatedBy) return;
        if (submitting) return; // prevent double-click

        // Block duplicate if not explicitly allowed
        if (alreadyBilledInvoice && !allowDuplicate) {
            alert('This booking already has an invoice. Please tick the confirmation checkbox to create another one.');
            return;
        }

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
            setSubmitting(true);
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
                    clinicId: clinicId || clinics.find(c => c.name === clinicName)?.id || undefined,
                    clinicName: clinicName || undefined,
                    generatedBy,
                    date: new Date().toISOString().split('T')[0],
                    notes: notes || undefined,
                    // Booking linkage fields
                    bookingId: linkedBookingId || undefined,
                    sbId: linkedSbId || undefined,
                    // Online reference (SB invoice number or Stripe ref)
                    onlineReference: onlineReference || undefined,
                    allowDuplicate,
                }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 409 && payload?.duplicateInvoice) {
                    setAlreadyBilledInvoice(payload.duplicateInvoice);
                    setAllowDuplicate(false);
                    alert(`An invoice already exists for this booking: ${payload.duplicateInvoice.invoiceNumber}`);
                    return;
                }
                alert(payload?.error || 'Failed to create invoice');
                return;
            }

            await loadInvoices();
            // The billing API marks linked appointments as billed; refresh the picker data.
            fetch('/api/admin/bookings').then(res => res.json()).then(data => setBookings(Array.isArray(data) ? data : [])).catch(() => {});
            resetForm();
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error('Failed to create invoice', error);
            alert('Failed to create invoice');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 print:p-0 print:bg-white print:min-h-0">
            <datalist id="services-list">
                {Array.from(new Map(clinics.filter(c => (clinicName && clinics.some(cl => cl.name === clinicName)) ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.name}>{s.price} AED</option>
                ))}
            </datalist>
            <datalist id="packages-list">
                {Array.from(new Set(clinics.filter(c => (clinicName && clinics.some(cl => cl.name === clinicName)) ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).flatMap(s => { const pkgs = []; if (s.threeSessionPackage) pkgs.push(`3 Sessions - ${s.name}`); if (s.sixSessionPackage) pkgs.push(`6 Sessions - ${s.name}`); return pkgs; }))).sort().map((pkg, i) => (
                    <option key={i} value={pkg} />
                ))}
            </datalist>

            <div className="max-w-6xl mx-auto print:hidden">
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
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto print:hidden">
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8 border border-gray-200 dark:border-gray-850 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" /> Generate Client Invoice
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 text-xl font-medium">✕</button>
                        </div>
                        
                        {/* Scrollable Form Body */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-2">

                            {/* Card 1: Search & Auto-Fill Booking */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-850 rounded-xl p-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                                    <Search className="w-3.5 h-3.5" /> Search & Auto-Fill Client Booking
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-4 h-4 text-indigo-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by patient name, phone, or booking ID..."
                                        className="w-full pl-10 p-2.5 border border-indigo-300 dark:border-indigo-750 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                                                            onClick={() => handleSelectBooking(b)}>
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
                                        <button type="button" onClick={() => { setSelectedBooking(null); resetForm(); }} className="text-xs text-indigo-600 hover:text-indigo-800 underline">Clear</button>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Patient & Appointment Details */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b dark:border-gray-800 pb-2">
                                    <User className="w-4 h-4 text-indigo-600" /> Patient & Appointment Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-3">
                                        {linkedBookingId && (
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Appointment Number</label>
                                                <div className="w-full p-2 border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-900 dark:text-indigo-200 font-mono">
                                                    {linkedBookingId}
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Patient Name *</label>
                                            <input type="text" required className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">WhatsApp / Phone *</label>
                                            <input type="tel" required className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email Address</label>
                                            <input type="email" className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-400" /> Date</label>
                                                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> Time Slot</label>
                                                <input type="text" placeholder="e.g. 10:00 AM" className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5 text-indigo-400" /> Doctor / Therapist</label>
                                            <input type="text" placeholder="Practitioner name" className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-indigo-400" /> Clinic Branch</label>
                                            <select
                                                className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                value={clinicId || clinics.find(c => c.name === clinicName)?.id || ''}
                                                onChange={(e) => {
                                                    const selectedClinic = clinics.find(c => c.id === e.target.value);
                                                    setClinicId(selectedClinic?.id || '');
                                                    setClinicName(selectedClinic?.name || '');
                                                }}
                                            >
                                                <option value="">— Select branch —</option>
                                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Services & Procedures */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b dark:border-gray-800 pb-2">
                                    <Receipt className="w-4 h-4 text-indigo-600" /> Services & Procedures
                                </h3>
                                
                                {/* Desktop headers */}
                                <div className="hidden md:flex md:items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">
                                    <div className="flex-1">Service / Package Description</div>
                                    <div className="w-16">Qty</div>
                                    <div className="w-24">Reg. Price</div>
                                    <div className="w-20">Disc. %</div>
                                    <div className="w-24">Disc. AED</div>
                                    <div className="w-24 text-right">Net Price</div>
                                    {items.length > 1 && <div className="w-8"></div>}
                                </div>

                                <div className="space-y-2">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 mb-4 md:mb-2 bg-gray-50 dark:bg-gray-800/30 md:bg-transparent md:dark:bg-transparent p-3 md:p-0 rounded-lg border border-gray-200 dark:border-gray-700 md:border-0">
                                            {item.description.startsWith('[Add-on]') ? (
                                                <input type="text" readOnly className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-550 dark:text-gray-400 text-sm" value={item.description} />
                                            ) : item.isCustom ? (
                                                <div className="flex-1 flex items-center gap-1 border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-gray-855 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
                                                    <input 
                                                        type="text" 
                                                        autoFocus 
                                                        placeholder="Enter custom service description..." 
                                                        className="flex-1 p-2 bg-transparent text-sm focus:outline-none dark:text-white" 
                                                        value={item.description} 
                                                        onChange={e => { const u = [...items]; u[idx].description = e.target.value; setItems(u); }} 
                                                    />
                                                    <button type="button" onClick={() => { const u = [...items]; u[idx].isCustom = false; u[idx].description = ''; setItems(u); }} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 py-2 transition-colors border-l dark:border-gray-650" title="Cancel Custom Entry">Cancel</button>
                                                </div>
                                            ) : (
                                                <select 
                                                    className="flex-1 p-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-850 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                                                    value={
                                                        clinics.flatMap(c => c.departments.flatMap(d => d.services)).some(s => s.name === item.description || (s.threeSessionPackage && `3 Sessions - ${s.name} (Valid for ${s.threeSessionPackage.validity || 90} days)` === item.description) || (s.sixSessionPackage && `6 Sessions - ${s.name} (Valid for ${s.sixSessionPackage.validity || 180} days)` === item.description)) 
                                                        ? item.description 
                                                        : (item.description ? item.description : "")
                                                    }
                                                    onChange={(e) => { 
                                                        const val = e.target.value;
                                                        if (val === '___custom___') {
                                                            const u = [...items];
                                                            u[idx].isCustom = true;
                                                            u[idx].description = '';
                                                            u[idx].unitPrice = 0;
                                                            u[idx].regularPrice = 0;
                                                            u[idx].discountAmount = 0;
                                                            setItems(u);
                                                            return;
                                                        }

                                                        const u = [...items]; 
                                                        u[idx] = { ...u[idx], description: val };
                                                        if (val) {
                                                            let matchedService = null;
                                                            let matchedClinic = null;
                                                            let isPackageMode = false;
                                                            let sessionCount = 1;
                                                            let pkgMatchData: any = null;

                                                            for(const c of clinics) {
                                                                if (clinicName && c.name !== clinicName) continue;
                                                                for(const d of c.departments) {
                                                                    let hit = d.services.find(s => s.name === val);
                                                                    if(hit) { matchedService = hit; matchedClinic = c; break; }

                                                                    hit = d.services.find(s => s.threeSessionPackage && `3 Sessions - ${s.name} (Valid for ${s.threeSessionPackage.validity || 90} days)` === val);
                                                                    if (hit) { matchedService = hit; matchedClinic = c; isPackageMode = true; sessionCount = 3; pkgMatchData = hit.threeSessionPackage; break; }

                                                                    hit = d.services.find(s => s.sixSessionPackage && `6 Sessions - ${s.name} (Valid for ${s.sixSessionPackage.validity || 180} days)` === val);
                                                                    if (hit) { matchedService = hit; matchedClinic = c; isPackageMode = true; sessionCount = 6; pkgMatchData = hit.sixSessionPackage; break; }
                                                                }
                                                                if (matchedService) break;
                                                            }
                                                            
                                                            if (matchedService) {
                                                                const svcReg = isPackageMode && pkgMatchData ? pkgMatchData.totalCost : (matchedService.regularPrice || matchedService.price || 0);
                                                                const svcFinalInc = isPackageMode && pkgMatchData ? pkgMatchData.discountedPrice : (matchedService.discountedPrice !== undefined ? matchedService.discountedPrice : svcReg);

                                                                u[idx].regularPrice = svcReg;
                                                                u[idx].maxDiscountPercentage = matchedService.maxDiscountPercentage || 0;
                                                                u[idx].unitPrice = svcFinalInc;
                                                                u[idx].discountAmount = svcReg - svcFinalInc;
                                                                const targetClinicId = matchedClinic?.id || clinicId || undefined;

                                                                if (isPackageMode && pkgMatchData) {
                                                                    u[idx].packagePayload = {
                                                                        serviceId: matchedService.id,
                                                                        serviceName: matchedService.name,
                                                                        sessionCount: sessionCount,
                                                                        validity: pkgMatchData.validity || (sessionCount === 3 ? 90 : 180),
                                                                        price: svcFinalInc
                                                                    };
                                                                    u[idx].consumptions = [];
                                                                } else {
                                                                    u[idx].packagePayload = undefined;
                                                                    u[idx].consumptions = buildServiceConsumptions(matchedService, batchesMap, targetClinicId);
                                                                    void hydrateServiceConsumptionsForItem(matchedService, idx, targetClinicId, val);
                                                                }
                                                                
                                                                if (!clinicName && matchedClinic) {
                                                                    setClinicId(matchedClinic.id);
                                                                    setClinicName(matchedClinic.name);
                                                                }
                                                            }
                                                        }
                                                        setItems(u); 
                                                    }} 
                                                >
                                                    <option value="">— Select a Service or Package —</option>
                                                    {Array.from(new Map(clinics.filter(c => (clinicName && clinics.some(cl => cl.name === clinicName)) ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).map(s => [s.name, s])).values()).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                                        <option key={s.id} value={s.name}>{s.name} ({s.price} AED)</option>
                                                    ))}
                                                    {Array.from(new Set(clinics.filter(c => (clinicName && clinics.some(cl => cl.name === clinicName)) ? c.name === clinicName : true).flatMap(c => c.departments.flatMap(d => d.services)).flatMap(s => { const pkgs = []; if (s.threeSessionPackage) pkgs.push(`3 Sessions - ${s.name} (Valid for ${s.threeSessionPackage.validity || 90} days)`); if (s.sixSessionPackage) pkgs.push(`6 Sessions - ${s.name} (Valid for ${s.sixSessionPackage.validity || 180} days)`); return pkgs; }))).sort().map((pkg, i) => (
                                                        <option key={`pkg-${i}`} value={pkg}>{pkg}</option>
                                                    ))}
                                                    {item.description && !item.description.startsWith('[Add-on]') && !clinics.flatMap(c => c.departments.flatMap(d => d.services)).some(s => s.name === item.description || (s.threeSessionPackage && `3 Sessions - ${s.name} (Valid for ${s.threeSessionPackage.validity || 90} days)` === item.description) || (s.sixSessionPackage && `6 Sessions - ${s.name} (Valid for ${s.sixSessionPackage.validity || 180} days)` === item.description)) && (
                                                        <option value={item.description}>{item.description} (Archived/Custom)</option>
                                                    )}
                                                    <option value="___custom___">➕ Custom / Free Text Entry</option>
                                                </select>
                                            )}
                                            <input type="number" min="1" placeholder="Qty" className="w-full md:w-16 p-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-855 text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={item.quantity} onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], quantity: Number(e.target.value) }; setItems(u); }} />
                                            <input type="number" min="0" placeholder="Reg.Price" className="w-full md:w-24 p-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-855 text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={item.regularPrice !== undefined ? item.regularPrice : item.unitPrice || ''} 
                                                onChange={(e) => { 
                                                    const u = [...items]; 
                                                    u[idx].regularPrice = Number(e.target.value); 
                                                    u[idx].unitPrice = u[idx].regularPrice! - (u[idx].discountAmount || 0); 
                                                    setItems(u); 
                                                }} />
                                            <input type="number" min="0" max={item.maxDiscountPercentage || ''} placeholder="Disc. %" className="w-full md:w-20 p-2 border border-indigo-200 dark:border-indigo-900 rounded-lg dark:bg-gray-855 text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={item.regularPrice && item.discountAmount ? Number(((item.discountAmount / item.regularPrice) * 100).toFixed(2)) : ''} 
                                                onChange={(e) => { 
                                                    const u = [...items]; 
                                                    let pct = Number(e.target.value);
                                                    if (u[idx].maxDiscountPercentage !== undefined && u[idx].maxDiscountPercentage !== 0 && pct > u[idx].maxDiscountPercentage!) {
                                                        pct = u[idx].maxDiscountPercentage!;
                                                    }
                                                    const discAmt = (u[idx].regularPrice || 0) * (pct / 100);
                                                    u[idx].discountAmount = Number(discAmt.toFixed(2)); 
                                                    u[idx].unitPrice = Number(((u[idx].regularPrice || 0) - u[idx].discountAmount).toFixed(2)); 
                                                    setItems(u); 
                                                }} />
                                            <input type="number" min="0" placeholder="Disc. AED" className="w-full md:w-24 p-2 border border-green-200 dark:border-green-900 rounded-lg dark:bg-gray-855 text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={item.discountAmount !== undefined && item.discountAmount !== 0 ? item.discountAmount : ''} 
                                                onChange={(e) => { 
                                                    const u = [...items]; 
                                                    let maxAmt = (u[idx].regularPrice || 0) * ((u[idx].maxDiscountPercentage !== undefined ? u[idx].maxDiscountPercentage : 100) / 100);
                                                    let amt = Number(e.target.value);
                                                    if (u[idx].maxDiscountPercentage !== undefined && u[idx].maxDiscountPercentage !== 0 && amt > maxAmt) {
                                                        amt = maxAmt;
                                                    }
                                                    u[idx].discountAmount = amt; 
                                                    u[idx].unitPrice = Number(((u[idx].regularPrice || 0) - u[idx].discountAmount).toFixed(2)); 
                                                    setItems(u); 
                                                }} />
                                            <div className="w-full md:w-24 px-2 py-2 text-sm text-right font-bold md:font-semibold bg-gray-50 dark:bg-gray-855 border dark:border-gray-700 rounded-lg flex-shrink-0" title="Discounted Price">
                                                {Number(item.unitPrice || 0).toFixed(2)}
                                            </div>
                                            {items.length > 1 && (
                                                <div className="w-8 flex items-center justify-center flex-shrink-0">
                                                    <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold text-sm">✕</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, regularPrice: 0, discountAmount: 0, maxDiscountPercentage: 0, consumptions: [] }])} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">+ Add New Item Row</button>
                                
                                {/* Add-ons section */}
                                <div className="pt-4 border-t border-gray-150 dark:border-gray-800 mt-4">
                                    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10 border border-indigo-100 dark:border-indigo-900 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                                                    <Zap className="w-4 h-4 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Procedure Add-on Services</p>
                                                    <p className="text-[10px] text-gray-500">Linked stock consumables will deduct automatically</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedAddons.size > 0 && (
                                                    <span className="text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">
                                                        {selectedAddons.size} Added
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {addonServices.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">No add-ons available.</p>
                                        ) : (
                                            <select
                                                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-indigo-500"
                                                value=""
                                                onChange={e => {
                                                    const addon = addonServices.find(a => a.id === e.target.value);
                                                    if (addon && !selectedAddons.has(addon.id)) toggleAddon(addon);
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="" disabled>➕ Select an add-on procedure to append...</option>
                                                {(() => {
                                                    const grouped = addonServices.reduce<Record<string, AddonService[]>>((acc, a) => {
                                                        if (!acc[a.group]) acc[a.group] = [];
                                                        acc[a.group].push(a);
                                                        return acc;
                                                    }, {});
                                                    return Object.entries(grouped).map(([group, grpAddons]) => (
                                                        <optgroup key={group} label={`── ${group} ──`}>
                                                            {grpAddons.map(a => (
                                                                <option key={a.id} value={a.id} disabled={selectedAddons.has(a.id)}>
                                                                    {selectedAddons.has(a.id) ? '✓ ' : ''}{a.name} — {addonPrices[a.id] ?? a.defaultPrice} AED
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ));
                                                })()}
                                            </select>
                                        )}

                                        {selectedAddons.size > 0 && (
                                            <div className="space-y-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-900">
                                                {addonServices.filter(a => selectedAddons.has(a.id)).map(addon => {
                                                    const desc = `[Add-on] ${addon.name}`;
                                                    const notFetched = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : []).some(c => !batchesMap[c.medicineId]);
                                                    const allHaveBatch = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : []).every(c => !!pickBestBatch(c.medicineId));
                                                    const noLink = (Array.isArray(addon.linkedConsumables) ? addon.linkedConsumables : []).length === 0;
                                                    return (
                                                        <div key={addon.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs">
                                                            <span className="flex-1 font-semibold text-gray-800 dark:text-gray-200 truncate">{addon.name}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                                noLink ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                                                                notFetched ? 'bg-gray-100 text-gray-500' :
                                                                allHaveBatch ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                                'bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                                                            }`}>
                                                                {noLink ? 'no stock link' : notFetched ? 'stock check' : allHaveBatch ? 'in stock' : 'low stock'}
                                                            </span>
                                                            <div className="flex items-center border dark:border-gray-600 rounded-lg overflow-hidden shrink-0">
                                                                <input
                                                                    type="number" min="0"
                                                                    className="w-14 p-1 text-right bg-white dark:bg-gray-700 focus:outline-none border-none text-xs"
                                                                    value={addonPrices[addon.id] ?? addon.defaultPrice}
                                                                    onChange={e => {
                                                                        const np = Number(e.target.value);
                                                                        setAddonPrices(prev => ({ ...prev, [addon.id]: np }));
                                                                        setItems(prev => prev.map(i => i.description === desc ? { ...i, unitPrice: np, regularPrice: np } : i));
                                                                    }}
                                                                />
                                                                <span className="text-[10px] pr-1.5 text-gray-400 bg-white dark:bg-gray-700">AED</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAddon(addon)}
                                                                className="p-1 text-red-500 hover:text-red-750 transition-colors shrink-0 font-bold"
                                                                title="Remove add-on"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Inventory & Consumables */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b dark:border-gray-800 pb-2">
                                    <Package className="w-4 h-4 text-indigo-600" /> Physical Stock lot deductions
                                </h3>
                                <p className="text-xs text-gray-500">Physical lot batches will deduct automatically from pharmacy inventory upon billing posting.</p>
                                
                                <div className="space-y-4">
                                        {items.map((item, idx) => (
                                            <div key={idx} className="bg-gray-50 dark:bg-gray-850/50 rounded-xl p-3 border border-gray-150 dark:border-gray-850 space-y-2">
                                                <div className="flex items-center justify-between pb-1 border-b dark:border-gray-800">
                                                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Item {idx + 1}: <span className="font-semibold text-gray-900 dark:text-white">{item.description || '(description missing)'}</span> <span className="text-gray-400 font-normal">(Qty: {item.quantity})</span></div>
                                                    <button type="button" onClick={() => {
                                                        const u = [...items];
                                                        u[idx] = { ...item, consumptions: [...(item.consumptions || []), { medicineId: '', quantity: 1 }] };
                                                        setItems(u);
                                                    }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-md">+ Add Resource Link</button>
                                                </div>

                                                {(item.consumptions || []).length === 0 && (
                                                    <div className="text-xs text-gray-400 italic bg-white dark:bg-gray-900/60 p-3 rounded-lg border border-dashed dark:border-gray-800">
                                                        No stock linked for this invoice item yet. Add a resource link if staff used a consumable during billing.
                                                    </div>
                                                )}

                                                <div className="space-y-2 pt-1">
                                                    {(item.consumptions || []).map((cons, cIdx) => (
                                                        <div key={cIdx} className="relative pl-4 border-l-2 border-indigo-200 dark:border-indigo-850">
                                                            <button type="button" onClick={() => {
                                                                const u = [...items];
                                                                u[idx].consumptions = u[idx].consumptions!.filter((_, i) => i !== cIdx);
                                                                setItems(u);
                                                            }} className="absolute -left-[9px] top-1.5 bg-white dark:bg-gray-800 text-red-500 hover:text-red-700 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow border dark:border-gray-700 font-bold">✕</button>

                                                            <div className="grid grid-cols-12 gap-2 mt-1">
                                                                <div className="col-span-6 md:col-span-5">
                                                                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">Medicine/Consumable</label>
                                                                    <select className="w-full p-1.5 border dark:border-gray-700 rounded text-[10px] bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-250 focus:outline-none"
                                                                        value={cons.medicineId || ''}
                                                                        onChange={async e => {
                                                                            const medicineId = e.target.value;
                                                                            const fetchedBatches = medicineId ? await fetchBatchesForMedicine(medicineId) : [];
                                                                            const bestBatch = medicineId
                                                                                ? pickBestBatchForMedicine(fetchedBatches, clinicId || undefined, cons.quantity || 1)
                                                                                : undefined;
                                                                            const u = [...items];
                                                                            u[idx].consumptions![cIdx] = { ...cons, medicineId, batchId: bestBatch?.id };
                                                                            setItems(u);
                                                                        }}>
                                                                        <option value="">— Select Medicine —</option>
                                                                        {medicines.map(m => (
                                                                            <option key={m.id} value={m.id}>{m.name} (Stock: {clinicId ? (m.branchStock?.find(b => b.clinicId === clinicId)?.quantity ?? 0) : m.centralStock})</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="col-span-6 md:col-span-5">
                                                                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">Physical Batch (Lot)</label>
                                                                    <select className="w-full p-1.5 border dark:border-gray-700 rounded text-[10px] bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-250 focus:outline-none"
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
                                                                            const availableQty = getBatchAvailableQuantity(b, clinicId || undefined);
                                                                            return (
                                                                                <option key={b.id} value={b.id} disabled={!!isExp || availableQty <= 0}>
                                                                                    {b.batchNumber} (Qty: {availableQty}) {isExp ? 'EXPIRED' : ''}
                                                                                </option>
                                                                            );
                                                                        })}
                                                                    </select>
                                                                </div>
                                                                <div className="col-span-12 md:col-span-2">
                                                                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">Burn Qty</label>
                                                                    <input type="number" min="1" className="w-full p-1.5 border dark:border-gray-700 rounded text-[10px] bg-white dark:bg-gray-800 focus:outline-none"
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
                                                                const availableQty = getBatchAvailableQuantity(batch, clinicId || undefined);
                                                                const insufficient = availableQty < totalNeeded;
                                                                if (isExp || insufficient) {
                                                                    return (
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 mt-1.5 bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-100 dark:border-red-950/30">
                                                                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                                            {isExp ? 'This physical lot has EXPIRED!' : `Needs ${totalNeeded} units total (${cons.quantity} × ${item.quantity} services). Only ${availableQty} available!`}
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                                                                        ✓ {availableQty} units available · Processing a {totalNeeded}-unit deduction
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Card 5: Invoice Settings & Configurations */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b dark:border-gray-800 pb-2">
                                    <CreditCard className="w-4 h-4 text-indigo-600" /> Invoice Settings & Payment
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Document Type *</label>
                                        <select className="w-full p-2 border rounded-lg dark:bg-gray-850 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={invoiceCategory} onChange={(e) => setInvoiceCategory(e.target.value)}>
                                            <option value="clinic_single">Single Session Invoice (FMC-SIV)</option>
                                            <option value="clinic_package">Package Bill (FMC-PKG)</option>
                                            <option value="package_session">Session billed from Package (FMC-PIV)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Payment Method *</label>
                                        <select className="w-full p-2 border rounded-lg dark:bg-gray-855 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                                            <option value="cash">Cash</option>
                                            <option value="card">Card</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="online">Online</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">VAT Percentage (%)</label>
                                        <input type="number" min="0" max="100" className="w-full p-2 border rounded-lg dark:bg-gray-850 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={taxPercentage} onChange={(e) => setTaxPercentage(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Generated By (Staff Member) *</label>
                                        <input type="text" required placeholder="Staff name" className="w-full p-2 border rounded-lg dark:bg-gray-850 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={generatedBy} onChange={(e) => setGeneratedBy(e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Linked Package</label>
                                        <input type="text" list="packages-list" placeholder="Select or type Package name" className="w-full p-2 border rounded-lg dark:bg-gray-855 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={packageDetails} 
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
                                                            const matchedClinic = clinics.find(c => c.name === matchedClinicName);
                                                            setClinicId(matchedClinic?.id || '');
                                                            setClinicName(matchedClinicName);
                                                        }
                                                    }
                                                }
                                            }} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Billing Notes / Comments</label>
                                        <input type="text" placeholder="Optional notes printed on invoice" className="w-full p-2 border rounded-lg dark:bg-gray-850 dark:border-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
                                    </div>
                                </div>

                                {/* Online Reference */}
                                {(paymentMethod === 'online' || paymentMethod === 'card' || onlineReference) && (
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3.5 flex items-center gap-3">
                                        <CreditCard className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                                                Online Transaction Reference
                                                {onlineReference && <span className="ml-1 text-[9px] font-normal text-emerald-600">(pre-filled SimplyBook ref)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. SI-2026000362 or Stripe Charge ID"
                                                className="w-full p-2 border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                value={onlineReference}
                                                onChange={(e) => setOnlineReference(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Duplicate Warning */}
                                {alreadyBilledInvoice && (
                                    <div className="bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
                                        <div className="flex items-start gap-3 [&>span]:hidden">
                                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                            <span className="text-red-500 text-lg mt-0.5">⚠</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                                                    This booking already has an invoice: <span className="font-mono">{alreadyBilledInvoice.invoiceNumber}</span>
                                                </p>
                                                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                                                    Generating another invoice may result in a duplicate charge. Only continue if the previous invoice was voided.
                                                </p>
                                                <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={allowDuplicate}
                                                        onChange={e => setAllowDuplicate(e.target.checked)}
                                                        className="w-4 h-4 accent-red-600 rounded"
                                                    />
                                                    <span className="text-xs font-bold text-red-700 dark:text-red-300">
                                                        I understand — create a new invoice anyway
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Persistent Footer */}
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Left side: Price Summary */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                                {totalDiscount > 0 && (
                                    <div className="text-gray-500 dark:text-gray-400">
                                        Gross: <span className="font-semibold text-gray-750 dark:text-gray-300">{grossTotal.toFixed(2)} AED</span>
                                    </div>
                                )}
                                {totalDiscount > 0 && (
                                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        Disc: <span className="font-semibold">-{totalDiscount.toFixed(2)} AED</span>
                                    </div>
                                )}
                                <div className="text-gray-500 dark:text-gray-400">
                                    Net: <span className="font-semibold text-gray-750 dark:text-gray-300">{subtotal.toFixed(2)} AED</span>
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">
                                    VAT ({taxPercentage}%): <span className="font-semibold text-gray-750 dark:text-gray-300">{taxAmount.toFixed(2)} AED</span>
                                </div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                                    <span>Total:</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{totalAmount.toFixed(2)} AED</span>
                                </div>
                            </div>

                            {/* Right side: Action Buttons */}
                            <div className="flex items-center gap-3 justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreateModalOpen(false)} 
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-750 dark:text-gray-300 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateInvoice}
                                    disabled={submitting || (!!alreadyBilledInvoice && !allowDuplicate)}
                                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    {submitting && (
                                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                        </svg>
                                    )}
                                    {submitting ? 'Saving...' : alreadyBilledInvoice && !allowDuplicate ? '⚠ Confirm Before Saving' : 'Create Invoice'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


                {viewingInvoice && (

                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto print:static print:p-0 print:bg-white print:block">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl print:shadow-none print:max-w-none print:p-0 print:rounded-none print:w-full print:bg-white print:text-black">
                            {/* Premium Tax Invoice Header */}
                            <div className="border-b-2 border-indigo-600 pb-4 mb-6 print:border-gray-350 print:pb-3 print:mb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400 print:text-black">
                                            FIRST MEDICAL CENTER LLC
                                        </h1>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-600 mt-0.5">
                                            Premium Aesthetic & Laser Clinic
                                        </p>
                                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-gray-800 mt-2">
                                            TRN No: 100613574100003
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-lg font-black text-gray-900 dark:text-white print:text-black tracking-wide">
                                            TAX INVOICE
                                        </h2>
                                        <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 print:text-black mt-1">
                                            {viewingInvoice.invoiceNumber}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-600 mt-1">
                                            Date: {viewingInvoice.date}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingInvoice(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl print:hidden">✕</button>
                            </div>

                            {/* Client & Appointment Info */}
                            <div className="grid grid-cols-2 gap-6 text-xs mb-6 border-b dark:border-gray-700 pb-4 print:border-gray-200 print:mb-4 print:pb-3 print:gap-4">
                                <div>
                                    <h3 className="font-bold text-gray-700 dark:text-gray-300 print:text-gray-800 uppercase tracking-wider mb-2 print:mb-1">
                                        Patient Details
                                    </h3>
                                    <div className="space-y-1 text-gray-950 dark:text-white print:text-black">
                                        <div className="font-bold text-sm">{viewingInvoice.clientName}</div>
                                        <div>Phone: {viewingInvoice.clientPhone}</div>
                                        {viewingInvoice.clientEmail && <div>Email: {viewingInvoice.clientEmail}</div>}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-700 dark:text-gray-300 print:text-gray-800 uppercase tracking-wider mb-2 print:mb-1">
                                        Clinic & Appointment
                                    </h3>
                                    <div className="space-y-1 text-gray-950 dark:text-white print:text-black">
                                        {viewingInvoice.clinicName && <div>Branch: <span className="font-medium">{viewingInvoice.clinicName}</span></div>}
                                        {viewingInvoice.notes && (viewingInvoice.notes.includes("Doctor:") || viewingInvoice.notes.includes("Time:")) ? (
                                            <>
                                                {(() => {
                                                    const notes = viewingInvoice.notes || '';
                                                    const docMatch = notes.match(/Doctor:\s*([^|]+)/);
                                                    const dateMatch = notes.match(/Date:\s*([^|]+)/);
                                                    const timeMatch = notes.match(/Time:\s*([^|]+)/);
                                                    return (
                                                        <>
                                                            {docMatch && <div>Doctor: {docMatch[1].trim()}</div>}
                                                            {dateMatch && <div>Appt Date: {dateMatch[1].trim()}</div>}
                                                            {timeMatch && <div>Time: {timeMatch[1].trim()}</div>}
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        ) : (
                                            <div>Generated By: {viewingInvoice.generatedBy}</div>
                                        )}
                                        <div>Payment Method: <span className="capitalize font-semibold">{viewingInvoice.paymentMethod}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Service Items Table */}
                            <table className="w-full text-xs mb-6 print:mb-4">
                                <thead>
                                    <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 print:text-gray-700 print:border-gray-300">
                                        <th className="text-left pb-2 font-bold">Item Description</th>
                                        <th className="text-right pb-2 w-12 font-bold">Qty</th>
                                        <th className="text-right pb-2 w-20 font-bold">Price (Ex. VAT)</th>
                                        <th className="text-right pb-2 w-16 font-bold">Disc.</th>
                                        <th className="text-right pb-2 w-16 font-bold">VAT (5%)</th>
                                        <th className="text-right pb-2 w-20 font-bold">Total (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 print:divide-gray-200">
                                    {viewingInvoice.items.map((item, idx) => {
                                        const itemReg = Number(item.regularPrice ?? item.unitPrice ?? 0);
                                        const itemDisc = Number(item.discountAmount ?? 0);
                                        const itemVat = (item.unitPrice * (viewingInvoice.taxPercentage / 100)) * item.quantity;
                                        const itemTotal = (item.unitPrice * (1 + viewingInvoice.taxPercentage / 100)) * item.quantity;
                                        return (
                                            <tr key={idx} className="text-gray-900 dark:text-white print:text-black">
                                                <td className="py-2.5 pr-2 break-words">
                                                    <div className="font-semibold">{item.description}</div>
                                                </td>
                                                <td className="text-right py-2.5 tabular-nums">{item.quantity}</td>
                                                <td className="text-right py-2.5 tabular-nums">{itemReg.toFixed(2)}</td>
                                                <td className="text-right py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400 print:text-black">
                                                    {itemDisc > 0 ? `-${itemDisc.toFixed(2)}` : '0.00'}
                                                </td>
                                                <td className="text-right py-2.5 tabular-nums">{itemVat.toFixed(2)}</td>
                                                <td className="text-right py-2.5 tabular-nums font-bold">{itemTotal.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Totals Summary */}
                            <div className="space-y-1.5 text-xs border-t pt-4 dark:border-gray-700 print:border-gray-300 print:pt-3">
                                {(() => {
                                    const vGross = viewingInvoice.items.reduce((sum, item) => sum + ((item.regularPrice !== undefined ? item.regularPrice : item.unitPrice) * item.quantity), 0);
                                    const vDisc = viewingInvoice.items.reduce((sum, item) => sum + ((item.discountAmount || 0) * item.quantity), 0);
                                    return (
                                        <>
                                            {vDisc > 0 && (
                                                <>
                                                    <div className="flex justify-between text-gray-500 print:text-gray-600"><span>Gross Total (Excl. VAT)</span><span>{vGross.toFixed(2)} AED</span></div>
                                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 print:text-black font-medium"><span>Total Discount</span><span>-{vDisc.toFixed(2)} AED</span></div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                                <div className="flex justify-between text-gray-500 print:text-gray-600"><span>Amount (Excluding VAT)</span><span>{viewingInvoice.subtotal.toFixed(2)} AED</span></div>
                                <div className="flex justify-between text-gray-500 print:text-gray-600"><span>VAT ({viewingInvoice.taxPercentage}%)</span><span>{viewingInvoice.taxAmount.toFixed(2)} AED</span></div>
                                <div className="flex justify-between font-bold text-sm border-t pt-2.5 dark:border-gray-600 print:border-gray-300 print:pt-2"><span>Total (Inclusive of VAT)</span><span className="text-indigo-600 dark:text-indigo-400 print:text-black text-base">{viewingInvoice.totalAmount.toFixed(2)} AED</span></div>
                            </div>
                            
                            {/* Payments References */}
                            {viewingInvoice.payments && viewingInvoice.payments.length > 0 && (
                                <div className="mt-5 border-t dark:border-gray-700 pt-4 print:mt-4 print:pt-3 print:border-gray-300">
                                    <h4 className="font-bold text-xs mb-2 text-gray-700 dark:text-gray-300 print:text-gray-800 uppercase tracking-wider">Payment References</h4>
                                    <div className="space-y-2">
                                        {viewingInvoice.payments.map((p, idx) => (
                                            <div key={idx} className="flex justify-between flex-wrap items-center text-xs bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded print:bg-white print:border print:border-gray-200">
                                                <div className="flex gap-2 items-center">
                                                    <span className="capitalize font-semibold text-gray-900 dark:text-white text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded print:border print:border-gray-300">{p.mode}</span>
                                                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold print:text-black">{p.referenceNumber}</span>
                                                </div>
                                                <div className="text-gray-500 text-right print:text-black">
                                                    <div className="font-bold text-gray-900 dark:text-white print:text-black">{p.amount.toFixed(2)} AED</div>
                                                    <div style={{fontSize: '9px'}} className="text-gray-400 print:text-gray-600 mt-0.5">{new Date(p.date).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Online Reference (if exists but payments empty) */}
                            {!(viewingInvoice.payments && viewingInvoice.payments.length > 0) && (viewingInvoice as any).onlineReference && (
                                <div className="mt-5 border-t dark:border-gray-700 pt-4 print:mt-4 print:pt-3 print:border-gray-300">
                                    <div className="flex items-center justify-between text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5 print:bg-white print:border-gray-200 print:text-black">
                                        <span className="text-emerald-700 dark:text-emerald-400 font-bold print:text-gray-800">Online Reference:</span>
                                        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-sm print:text-black">{(viewingInvoice as any).onlineReference}</span>
                                    </div>
                                </div>
                            )}

                            {viewingInvoice.notes && (
                                <div className="mt-4 text-[10px] text-gray-500 print:text-gray-700 border-t pt-2 dark:border-gray-700 print:border-gray-200">
                                    <strong>Notes:</strong> {viewingInvoice.notes}
                                </div>
                            )}
                            
                            {/* Policy Notice Footer */}
                            <div className="mt-6 border-t-2 border-dashed border-gray-200 dark:border-gray-700 pt-4 text-center text-[10px] text-gray-500 dark:text-gray-400 print:text-gray-600 print:border-gray-300 print:mt-5 print:pt-3">
                                <p className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 print:text-black text-[9px]">Important Policy Notice</p>
                                <p className="mt-1">Purchased services won't refund, complete the services before the expiry of validity date.</p>
                                <p className="mt-2 text-[9px] text-gray-400 dark:text-gray-500 print:text-gray-500 font-medium">Thank you for choosing First Medical Center LLC. We look forward to serving you again.</p>
                            </div>

                            {/* View Modal Action Buttons */}
                            <div className="mt-6 flex justify-end gap-3 print:hidden border-t pt-4 dark:border-gray-700">
                                <button onClick={() => setViewingInvoice(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors">
                                    Close
                                </button>
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm shadow-sm transition-colors">
                                    <Printer className="w-4 h-4" /> Print Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}


