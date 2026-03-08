'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Correct import for App Router
import { clinics, timeSlots, Clinic, Department, Service, Doctor, PromoCode, Medicine } from '@/lib/data';
import { useAuthStore } from '@/lib/store';
import { usePackagesStore } from '@/lib/packages-store';
import { useReviewDiscountStore } from '@/lib/review-discount-store';
import CustomerAuth from './auth/CustomerAuth';
import { Calendar, Clock, User, ChevronRight, ChevronDown, Check, MapPin, AlertCircle, Car, ArrowRight, Navigation, Star, Package as PackageIcon, Pill, Phone, Mail, ExternalLink, Map as MapIcon } from 'lucide-react';
import { format, addDays, startOfMonth, getMonth, getYear } from 'date-fns';
import { bookingVoiceController, VOICE_EVENTS, WIZARD_EVENTS, fuzzyMatch, STEP_NAMES } from '@/lib/booking-voice-controller';

// Default department images (fallback when no Azure Blob URL is set)
const DEPT_IMAGES: Record<string, string> = {
    'Dermatology & Aesthetics': '/images/departments/dermatology.png',
    'Laser & Electrolysis Hair Removal': '/images/departments/laser.png',
    'Nursing & Beauty Therapy': '/images/departments/nursing.png',
};
const DEFAULT_DEPT_IMAGE = '/images/departments/default.png';
const getDeptImage = (dept: { name: string; image?: string }) => dept.image || DEPT_IMAGES[dept.name] || DEFAULT_DEPT_IMAGE;

// Default branch images (fallback when no custom image is uploaded)
const BRANCH_IMAGES: Record<string, string> = {
    'Al Muraqabat Branch': '/images/branches/muraqabat.png',
    'Al Qiyadah Branch': '/images/branches/qiyadah.png',
    'Silicon Oasis Branch': '/images/branches/silicon_oasis.png',
};
const DEFAULT_BRANCH_IMAGE = '/images/branches/muraqabat.png';
const getBranchImage = (clinic: { name: string; image?: string }) => clinic.image || BRANCH_IMAGES[clinic.name] || DEFAULT_BRANCH_IMAGE;

// Helper: get current date/time in Dubai timezone (UTC+4)
function getDubaiNow(): Date {
    const now = new Date();
    const dubaiStr = now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' });
    return new Date(dubaiStr);
}

export default function BookingWizard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const { getMyPackages, useSession } = usePackagesStore();
    const { getReviewDiscount } = useReviewDiscountStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Safety check for stale data (e.g. users from before DOB update)
    // Only run this when mounted and authenticated to avoid hydration mismatches
    React.useEffect(() => {
        if (isMounted && isAuthenticated && user && !user.dateOfBirth) {
            console.warn("User profile stale (missing DOB), redirecting to login");
            useAuthStore.getState().logout();
            // router.push('/'); // Don't redirect, just logout
        }
    }, [isMounted, user, isAuthenticated]);

    // Prevent hydration mismatch by not rendering until mounted
    // if (!isMounted) return null; // MOVED TO END OF HOOKS

    // Steps: 0: Clinic, 1: Dept, 2: Category, 3: Service, 4: Doctor, 5: Date/Time, 6: Review
    const [step, setStep] = useState(0);
    const [whatsappNumber, setWhatsappNumber] = useState('');
    // Referral fields
    const [referredBy, setReferredBy] = useState<'none' | 'family' | 'friend' | 'employee'>('none');
    const [referralName, setReferralName] = useState('');
    const [referralContact, setReferralContact] = useState('');
    const [referralEmployeeName, setReferralEmployeeName] = useState('');
    const [referralEmployeeId, setReferralEmployeeId] = useState('');

    const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [isAnyDoctor, setIsAnyDoctor] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [expandedMapId, setExpandedMapId] = useState<string | null>(null);

    // Dynamic slots state
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    // Dynamic Services State
    const [clinicDepts, setClinicDepts] = useState<Department[]>([]);
    const [isLoadingServices, setIsLoadingServices] = useState(false);

    // Category images (from admin uploads)
    const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
    React.useEffect(() => {
        fetch('/api/admin/category-images').then(r => r.json()).then(data => {
            if (data && typeof data === 'object') setCategoryImages(data);
        }).catch(() => { });
    }, []);

    // Follow-up Logic state
    const [isFollowUp, setIsFollowUp] = useState(false);
    const [previousVisitDate, setPreviousVisitDate] = useState<string>('');

    // Medicine selection state
    const [medicineCatalog, setMedicineCatalog] = useState<Medicine[]>([]);
    const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
    const [showMedicinePicker, setShowMedicinePicker] = useState(false);

    // Fetch medicine catalog on mount
    React.useEffect(() => {
        fetch('/api/admin/medicines').then(res => res.json()).then(data => {
            if (Array.isArray(data)) setMedicineCatalog(data);
        }).catch(() => { });
    }, []);

    // Fetch services when clinic is selected
    React.useEffect(() => {
        if (selectedClinic) {
            const fetchServices = async () => {
                setIsLoadingServices(true);
                try {
                    const res = await fetch(`/api/admin/services?clinicId=${selectedClinic.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        // API returns the Clinic object with departments populated
                        if (data && data.departments) {
                            setClinicDepts(data.departments);
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch services');
                } finally {
                    setIsLoadingServices(false);
                }
            };
            fetchServices();
        }
    }, [selectedClinic]);

    // Generate next 90 days (3 months) for date selection, filtering by service, clinic, and doctor
    const availableDates = Array.from({ length: 90 })
        .map((_, i) => addDays(getDubaiNow(), i)) // starts from today (Dubai time)
        .filter(date => {
            const dayOfWeek = date.getDay(); // 0=Sun … 6=Sat
            const dateStr = format(date, 'yyyy-MM-dd');

            // Service Restrictions
            if (selectedService?.allowedDays && selectedService.allowedDays.length > 0) {
                if (!selectedService.allowedDays.includes(dayOfWeek)) return false;
            }
            // Clinic Restrictions
            if (selectedClinic?.workingDays && selectedClinic.workingDays.length > 0) {
                if (!selectedClinic.workingDays.includes(dayOfWeek)) return false;
            }
            // Doctor Restrictions
            if (selectedDoctor) {
                // Doctor not working
                if (selectedDoctor.status === 'not_working') return false;
                // Doctor's regular days off
                if (selectedDoctor.daysOff && selectedDoctor.daysOff.includes(dayOfWeek)) return false;
                // Outside doctor's employment period
                if (selectedDoctor.startDate && dateStr < selectedDoctor.startDate) return false;
                if (selectedDoctor.endDate && dateStr > selectedDoctor.endDate) return false;
            }
            return true;
        });

    // Group available dates by month for calendar view
    const [calendarMonthIndex, setCalendarMonthIndex] = useState(0);
    const datesByMonth = React.useMemo(() => {
        const groups: { key: string; label: string; dates: Date[] }[] = [];
        const monthMap = new Map<string, Date[]>();
        for (const d of availableDates) {
            const key = `${getYear(d)}-${getMonth(d)}`;
            if (!monthMap.has(key)) monthMap.set(key, []);
            monthMap.get(key)!.push(d);
        }
        for (const [key, dates] of monthMap) {
            groups.push({ key, label: format(dates[0], 'MMMM yyyy'), dates });
        }
        return groups;
    }, [availableDates.length, selectedService, selectedClinic]);
    const currentMonthGroup = datesByMonth[calendarMonthIndex] || datesByMonth[0];

    // Helper to parse "10:30 AM" to minutes from midnight (12h format)
    const parseTimeSlot = (timeStr: string) => {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    // Helper to parse "14:30" (24h) to minutes
    const parseWindowTime = (timeStr: string) => {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Fetch slots when doctor and date are selected
    React.useEffect(() => {
        if (selectedDoctor && selectedDate) {
            const fetchSlots = async () => {
                setIsLoadingSlots(true);
                setSelectedSlot(null); // Reset slot selection
                try {
                    const dateStr = format(selectedDate, 'yyyy-MM-dd');
                    const res = await fetch(`/api/admin/schedule?doctorId=${selectedDoctor.id}&date=${dateStr}&serviceId=${selectedService?.id || ''}`);
                    let slots: string[] = []; // Explicit type

                    if (res.ok) {
                        const data = await res.json();
                        if (data.slots && data.slots.length > 0) {
                            slots = data.slots;
                        } else {
                            // Fallback for demo: if no custom schedule, show all slots
                            slots = timeSlots;
                        }
                    } else {
                        slots = timeSlots;
                    }

                    // 1. Service Time Window Filtering
                    let serviceStart = 0;
                    let serviceEnd = 24 * 60;

                    if (selectedService?.timeWindow) {
                        const s = parseWindowTime(selectedService.timeWindow.start);
                        const e = parseWindowTime(selectedService.timeWindow.end);
                        if (s !== null) serviceStart = s;
                        if (e !== null) serviceEnd = e;
                    }

                    // 2. Clinic Operating Hours Filtering
                    let clinicStart = 0;
                    let clinicEnd = 24 * 60;

                    if (selectedClinic?.openingTime) {
                        const s = parseWindowTime(selectedClinic.openingTime);
                        if (s !== null) clinicStart = s;
                    }
                    if (selectedClinic?.closingTime) {
                        const e = parseWindowTime(selectedClinic.closingTime);
                        if (e !== null) clinicEnd = e;
                    }

                    // 3. Intersection (Max of starts, Min of ends)
                    const effectiveStart = Math.max(serviceStart, clinicStart);
                    const effectiveEnd = Math.min(serviceEnd, clinicEnd);

                    slots = slots.filter((slot: string) => {
                        const slotMins = parseTimeSlot(slot);
                        return slotMins >= effectiveStart && slotMins < effectiveEnd;
                    });

                    // 3b. If booking for today (Dubai time), hide slots less than 30 min from now
                    const now = getDubaiNow();
                    const isToday = selectedDate.toDateString() === now.toDateString();
                    if (isToday) {
                        const nowMins = now.getHours() * 60 + now.getMinutes();
                        const minLeadTime = 30; // must be at least 30 minutes before slot
                        slots = slots.filter((slot: string) => {
                            const slotMins = parseTimeSlot(slot);
                            return slotMins - nowMins >= minLeadTime;
                        });
                    }

                    // 4. Filter out slots already booked by this patient on the same date
                    if (user?.name) {
                        try {
                            const dateStr2 = format(selectedDate, 'yyyy-MM-dd');
                            const bRes = await fetch(`/api/admin/bookings?date=${dateStr2}&search=${encodeURIComponent(user.name)}`);
                            if (bRes.ok) {
                                const myBookings = await bRes.json();
                                const myBookedSlots = new Set(
                                    myBookings
                                        .filter((b: any) => b.status !== 'cancelled')
                                        .map((b: any) => b.slot)
                                );
                                slots = slots.filter((slot: string) => !myBookedSlots.has(slot));
                            }
                        } catch { /* ignore */ }
                    }

                    // 5. No-show peak restriction filter
                    if (user) {
                        try {
                            const rStore = require('@/lib/restrictions-store');
                            const clientId = user.phone || user.email || user.name || '';
                            slots = slots.filter((slot: string) =>
                                !rStore.useRestrictionsStore.getState().isSlotRestricted(clientId, selectedDate, slot, selectedService?.id)
                            );
                        } catch { /* ignore */ }
                    }

                    setAvailableSlots(slots);


                } catch (error) {
                    console.error('Error fetching slots', error);
                    setAvailableSlots([]);
                } finally {
                    setIsLoadingSlots(false);
                }
            };
            fetchSlots();
        }
    }, [selectedDoctor, selectedDate, selectedService]); // Added selectedService dependency

    const handleClinicSelect = (clinic: Clinic) => {
        setSelectedClinic(clinic);
        setStep(1);
        // Reset subsequent selections
        setSelectedDept(null); setSelectedCategory(null); setSelectedService(null); setSelectedDoctor(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 0, selected: clinic.name });
    };

    const handleDeptSelect = (dept: Department) => {
        setSelectedDept(dept);
        setStep(2); // → Category step
        setSelectedCategory(null); setSelectedService(null); setSelectedDoctor(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 1, selected: dept.name });
    };

    const handleCategorySelect = (category: string) => {
        setSelectedCategory(category);
        setStep(3); // → Service step
        setSelectedService(null); setSelectedDoctor(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 2, selected: category });
    };

    // Screening Questions State
    const [showScreening, setShowScreening] = useState(false);
    const [screeningAnswers, setScreeningAnswers] = useState<Record<number, boolean>>({});
    const [screeningError, setScreeningError] = useState<string | null>(null);

    // Determine if service needs medicine step and proceed accordingly
    const proceedAfterScreening = (service: Service) => {
        const mode = service.medicineSelectionMode || 'choose';
        const linkedMeds = service.medicineIds || [];
        const hasLinkedMeds = linkedMeds.length > 0;
        const maxMeds = service.maxMedicines || 0;

        if (mode === 'all' && hasLinkedMeds) {
            // Auto-select all linked medicines, skip picker
            setSelectedMedicineIds([...linkedMeds]);
            setStep(4);
            setSelectedDoctor(null);
        } else if (mode === 'either' && hasLinkedMeds) {
            // Show picker in radio mode
            setSelectedMedicineIds([]);
            setShowMedicinePicker(true);
        } else if (mode === 'choose' && (hasLinkedMeds || maxMeds > 0)) {
            // Show picker in checkbox mode
            setSelectedMedicineIds([]);
            setShowMedicinePicker(true);
        } else {
            setStep(4);
            setSelectedDoctor(null);
        }
    };

    const handleServiceSelect = (service: Service) => {
        if (service.screeningQuestions && service.screeningQuestions.length > 0) {
            setSelectedService(service);
            setShowScreening(true);
            setScreeningAnswers({});
            setScreeningError(null);
        } else {
            setSelectedService(service);
            proceedAfterScreening(service);
        }
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 3, selected: service.name });
    };

    const handleMedicineToggle = (medId: string) => {
        const mode = selectedService?.medicineSelectionMode || 'choose';
        if (mode === 'either') {
            // Radio style: only one at a time
            setSelectedMedicineIds(prev => prev.includes(medId) ? [] : [medId]);
        } else {
            setSelectedMedicineIds(prev => {
                if (prev.includes(medId)) {
                    return prev.filter(id => id !== medId);
                }
                const max = selectedService?.maxMedicines || 0;
                if (max > 0 && prev.length >= max) return prev; // at limit
                return [...prev, medId];
            });
        }
    };

    const handleMedicineConfirm = () => {
        setShowMedicinePicker(false);
        setStep(4);
        setSelectedDoctor(null);
    };

    const handleScreeningSubmit = () => {
        // specific check: if ANY answer is YES (true), block booking
        const hasYes = Object.values(screeningAnswers).some(ans => ans === true);
        if (hasYes) {
            setScreeningError("Based on your answers, you are not eligible for this service online. Please contact the clinic directly.");
            return;
        }

        // Check if all questions are answered (optional, but good UX)
        if (selectedService?.screeningQuestions && Object.keys(screeningAnswers).length < selectedService.screeningQuestions.length) {
            setScreeningError("Please answer all questions.");
            return;
        }

        setShowScreening(false);
        if (selectedService) {
            proceedAfterScreening(selectedService);
        } else {
            setStep(4);
            setSelectedDoctor(null);
        }
    };

    const handleDoctorSelect = (doc: Doctor, anyDoctor = false) => {
        setSelectedDoctor(doc);
        setIsAnyDoctor(anyDoctor);
        setStep(5);
        setSelectedDate(null); setSelectedSlot(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 4, selected: anyDoctor ? 'Any Available Doctor' : doc.name });
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 5, selected: format(date, 'EEEE, MMM d') });
    }

    const handleSlotSelect = (slot: string) => {
        setSelectedSlot(slot);
        setStep(6);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 5, selected: slot });
    };

    /* ── Voice Controller Integration ── */
    // Emit available options to the voice agent whenever the step changes
    useEffect(() => {
        bookingVoiceController.emit(WIZARD_EVENTS.STEP_CHANGED, { step, stepName: STEP_NAMES[step] || 'Unknown' });

        let items: { id: string; name: string; price?: number }[] = [];
        switch (step) {
            case 0: // Clinic selection
                items = clinics.map(c => ({ id: c.id, name: c.name }));
                break;
            case 1: // Department selection
                items = clinicDepts.map(d => ({ id: d.id, name: d.name }));
                break;
            case 2: { // Category selection
                if (selectedDept) {
                    const cats = Array.from(new Set(selectedDept.services
                        .filter(s => !s.allowedGender || s.allowedGender === 'both' || s.allowedGender === user?.gender)
                        .map(s => s.category || 'General Services')));
                    items = cats.map(c => ({ id: c, name: c }));
                }
                break;
            }
            case 3: // Service selection (filtered by category) — include price for voice agent
                if (selectedDept && selectedCategory) {
                    items = selectedDept.services
                        .filter(s => (s.category || 'General Services') === selectedCategory)
                        .filter(s => !s.allowedGender || s.allowedGender === 'both' || s.allowedGender === user?.gender)
                        .map(s => ({ id: s.id, name: s.name, price: s.price }));
                }
                break;
            case 4: // Doctor selection
                if (selectedDept) items = selectedDept.doctors.map(d => ({ id: d.id, name: d.name }));
                break;
            case 5: // Date/Time
                items = availableDates.map(d => ({ id: format(d, 'yyyy-MM-dd'), name: format(d, 'EEEE, MMM d') }));
                break;
        }
        if (items.length > 0) {
            bookingVoiceController.emit(WIZARD_EVENTS.OPTIONS, { step, items });
        }
    }, [step, clinicDepts, selectedDept, selectedCategory, availableDates, user?.gender]);

    // Emit slot options when available
    useEffect(() => {
        if (step === 5 && availableSlots.length > 0) {
            bookingVoiceController.emit(WIZARD_EVENTS.OPTIONS, {
                step: 5,
                items: availableSlots.map(s => ({ id: s, name: s })),
            });
        }
    }, [step, availableSlots]);

    // Subscribe to voice commands
    useEffect(() => {
        const unsubs: (() => void)[] = [];

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_CLINIC, (data: { id: string; name: string }) => {
            const clinic = clinics.find(c => c.id === data.id) || clinics.find(c => c.name.toLowerCase() === data.name?.toLowerCase());
            if (clinic) handleClinicSelect(clinic);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DEPT, (data: { id: string; name: string }) => {
            const dept = clinicDepts.find(d => d.id === data.id) || clinicDepts.find(d => d.name.toLowerCase() === data.name?.toLowerCase());
            if (dept) handleDeptSelect(dept);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_CATEGORY, (data: { id: string; name: string }) => {
            if (data.name) handleCategorySelect(data.name);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_SERVICE, (data: { id: string; name: string }) => {
            if (selectedDept) {
                const svc = selectedDept.services.find(s => s.id === data.id) || selectedDept.services.find(s => s.name.toLowerCase() === data.name?.toLowerCase());
                if (svc) handleServiceSelect(svc);
            }
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DOCTOR, (data: { id: string; name: string }) => {
            if (selectedDept) {
                const doc = selectedDept.doctors.find(d => d.id === data.id) || selectedDept.doctors.find(d => d.name.toLowerCase() === data.name?.toLowerCase());
                if (doc) handleDoctorSelect(doc);
            }
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DATE, (data: { date: string }) => {
            // Try to fuzzy-match date from available dates
            const match = fuzzyMatch(data.date, availableDates.map(d => ({ id: format(d, 'yyyy-MM-dd'), name: format(d, 'EEEE, MMM d') })));
            if (match) {
                const dateObj = availableDates.find(d => format(d, 'yyyy-MM-dd') === match.id);
                if (dateObj) handleDateSelect(dateObj);
            }
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_SLOT, (data: { time: string }) => {
            const match = fuzzyMatch(data.time, availableSlots.map(s => ({ id: s, name: s })));
            if (match) handleSlotSelect(match.id);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.CONFIRM, () => {
            if (step === 6) handleConfirm();
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.GO_BACK, () => {
            if (step > 0) setStep(step - 1);
        }));

        return () => unsubs.forEach(fn => fn());
    }, [step, clinicDepts, selectedDept, availableDates, availableSlots]);

    // Promo Code State
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    // --- Calculated State ---

    // Follow-up Status
    const getFollowUpStatus = () => {
        if (!selectedService?.followUpDuration || !isFollowUp || !previousVisitDate) return null;

        const prev = new Date(previousVisitDate);
        if (isNaN(prev.getTime())) return null;

        const today = new Date();
        const diffTime = Math.abs(today.getTime() - prev.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (prev > today) return { valid: false, message: "Previous date cannot be in the future." };

        if (diffDays <= selectedService.followUpDuration) {
            return { valid: true, message: `Free follow-up applied! (${diffDays} days since visit)` };
        } else {
            return { valid: false, message: `Follow-up expired. Valid for ${selectedService.followUpDuration} days (was ${diffDays} days ago).` };
        }
    };

    const followUpStatus = getFollowUpStatus();
    const isFree = followUpStatus?.valid || false;

    // Price Calculation
    const basePrice = selectedService?.discountedPrice || selectedService?.regularPrice || selectedService?.price || 0;
    const medicineTotal = selectedMedicineIds.reduce((sum, id) => {
        const med = medicineCatalog.find(m => m.id === id);
        return sum + (med?.price || 0);
    }, 0);
    const vatAmount = (selectedService?.isTaxable && selectedClinic?.vatPercentage)
        ? basePrice * (selectedClinic.vatPercentage / 100)
        : 0;
    const priceWithTax = basePrice + vatAmount + medicineTotal;

    // Final Price with Discounts
    const reviewDiscount = (isAuthenticated && user?.phone) ? getReviewDiscount(user.phone) : { percent: 0, reviewedBranches: 0, totalBranches: 0, hasSubFiveReview: false };
    const reviewDiscountAmount = (reviewDiscount.percent > 0 && !isFree) ? priceWithTax * (reviewDiscount.percent / 100) : 0;
    let finalPrice = priceWithTax;
    if (isFree) {
        finalPrice = 0;
    } else {
        if (appliedPromo) {
            finalPrice = Math.max(0, priceWithTax - discountAmount);
        }
        if (reviewDiscountAmount > 0) {
            finalPrice = Math.max(0, finalPrice - reviewDiscountAmount);
        }
    }

    const handleApplyPromo = async () => {
        if (!promoCodeInput) return;
        setIsValidatingPromo(true);
        setPromoError(null);

        try {
            const res = await fetch('/api/admin/promos');
            if (res.ok) {
                const promos: PromoCode[] = await res.json();
                const promo = promos.find(p => p.code === promoCodeInput && p.active);

                if (!promo) {
                    setPromoError('Invalid or inactive promo code.');
                    setAppliedPromo(null);
                    setDiscountAmount(0);
                    return;
                }

                // Check Service Applicability
                if (promo.applicableServiceIds && promo.applicableServiceIds.length > 0) {
                    if (selectedService && !promo.applicableServiceIds.includes(selectedService.id)) {
                        setPromoError('This code is not applicable to the selected service.');
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                        return;
                    }
                }

                // Check Department Applicability
                if (promo.applicableDepartmentIds && promo.applicableDepartmentIds.length > 0) {
                    if (selectedDept && !promo.applicableDepartmentIds.includes(selectedDept.id)) {
                        setPromoError('This code is not applicable to the selected department.');
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                        return;
                    }
                }

                // Check Validity Dates
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today local

                if (promo.validFrom) {
                    const validFrom = new Date(promo.validFrom);
                    // Standardize comparison to avoid timezone issues with string dates
                    // Simple string comparison for ISO dates (YYYY-MM-DD) works if we just compare the strings directly against today's formatted string
                    // But let's use date objects for robustness
                    if (today < validFrom) {
                        setPromoError('This promo code is not yet valid.');
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                        return;
                    }
                }

                if (promo.validUntil) {
                    const validUntil = new Date(promo.validUntil);
                    if (today > validUntil) {
                        setPromoError('This promo code has expired.');
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                        return;
                    }
                }

                // Calculate Discount
                let discount = 0;
                if (promo.discountType === 'percentage') {
                    discount = priceWithTax * promo.discountValue;
                } else {
                    discount = promo.discountValue;
                }

                setAppliedPromo(promo);
                setDiscountAmount(discount);
            } else {
                setPromoError('Failed to validate code.');
            }
        } catch (error) {
            setPromoError('Error validating code.');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleConfirm = async () => {
        // Proceed to Payment
        // In a real app, save booking state/intent ID here
        const bookingData: any = {
            clinicId: selectedClinic?.id,
            deptId: selectedDept?.id,
            serviceId: selectedService?.id,
            doctorId: selectedDoctor?.id,
            date: selectedDate?.toISOString().split('T')[0],
            slot: selectedSlot,
            patientName: user?.name || 'Guest',
            amount: finalPrice,
            promoCode: appliedPromo?.code,
            whatsappNumber: whatsappNumber,
            selectedMedicineIds: selectedMedicineIds.length > 0 ? selectedMedicineIds : undefined,
            referredBy: referredBy !== 'none' ? referredBy : undefined,
            referralName: referralName || undefined,
            referralContact: referralContact || undefined,
            referralEmployeeName: referralEmployeeName || undefined,
            referralEmployeeId: referralEmployeeId || undefined,
            anyDoctor: isAnyDoctor || undefined
        };

        try {
            // Persist booking
            const res = await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    alert(err.error || 'You already have a booking at this date and time.');
                    return;
                }
                throw new Error(err.error || 'Booking failed');
            }
        } catch (error) {
            console.error('Failed to save booking', error);
            alert('Failed to create booking. Please try again.');
            return;
        }

        // Store in URL params or context for the payment page
        const query = new URLSearchParams({
            amount: String(finalPrice.toFixed(2)),
            serviceName: selectedService?.name || '',
            bookingId: 'mock-booking-id-' + Date.now(),
            bookingDate: selectedDate?.toISOString().split('T')[0] || '',
            slot: selectedSlot || '',
            doctorName: isAnyDoctor ? '' : (selectedDoctor?.name || ''),
            clinicName: selectedClinic?.name || '',
            anyDoctor: isAnyDoctor ? 'true' : '',
            ...(appliedPromo ? { promo: appliedPromo.code } : {})
        }).toString();

        router.push(`/payment?${query}`);
    };

    // Remove strict auth redirect
    // React.useEffect(() => { ... }, ...);



    // --- Package Logic ---
    const myPackages = (isAuthenticated && user?.phone) ? getMyPackages(user.phone) : [];
    const applicablePackage = selectedService ? myPackages.find(p => p.remainingSessions[selectedService.id] > 0) : null;
    const [usePackageSession, setUsePackageSession] = useState(false);

    // Auto-select package if available
    useEffect(() => {
        if (applicablePackage) {
            setUsePackageSession(true);
        }
    }, [applicablePackage]);

    // Handle Package Confirmation
    const handlePackageConfirm = async () => {
        if (!applicablePackage || !selectedService || !user) return;

        const result = useSession(applicablePackage.id, selectedService.id);
        if (result.success) {
            const bookingData: any = {
                clinicId: selectedClinic?.id,
                deptId: selectedDept?.id,
                serviceId: selectedService?.id,
                doctorId: selectedDoctor?.id,
                date: selectedDate?.toISOString().split('T')[0],
                slot: selectedSlot,
                patientName: user.name,
                patientPhone: user.phone,
                amount: 0,
                paymentMethod: 'Package',
                packageId: applicablePackage.id,
                whatsappNumber: whatsappNumber,
                referredBy: referredBy !== 'none' ? referredBy : undefined,
                referralName: referralName || undefined,
                referralContact: referralContact || undefined,
                referralEmployeeName: referralEmployeeName || undefined,
                referralEmployeeId: referralEmployeeId || undefined
            };

            // Persist booking (Mock)
            console.log('Booking with package:', bookingData);
            await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            // Redirect to success / dashboard
            router.push('/customer/dashboard');
        } else {
            alert(result.message);
        }
    }


    // Prevent hydration mismatch by not rendering until mounted
    if (!isMounted) return (
        <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (!clinics || clinics.length === 0) {
        console.error("No clinics data available");
        return <div className="text-center p-12 text-red-500">System Error: No clinics configured.</div>;
    }

    // Auth gate: show registration/login if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg my-12">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to Booking</h1>
                    <p className="text-gray-500 dark:text-gray-400">Please register or log in to start your appointment booking.</p>
                </div>
                <CustomerAuth />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg my-12">

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {['Clinic', 'Dept', 'Category', 'Service', 'Doctor', 'Time', 'Review'].map((label, idx) => (
                        <span key={idx} className={step >= idx ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{label}</span>
                    ))}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / 7) * 100}%` }}></div>
                </div>
            </div>



            {/* Step 0: Select Clinic */}
            {
                step === 0 && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a Branch</h2>
                            <button
                                onClick={() => {
                                    if (navigator.geolocation) {
                                        navigator.geolocation.getCurrentPosition((position) => {
                                            const { latitude, longitude } = position.coords;
                                            setMyCoords({ lat: latitude, lng: longitude });
                                        }, (error) => {
                                            alert("Unable to retrieve your location. Please ensure location services are enabled.");
                                            console.error(error);
                                        });
                                    } else {
                                        alert("Geolocation is not supported by your browser.");
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                            >
                                <Navigation className="w-4 h-4" />
                                Show Distance from Me
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {clinics.map((clinic) => {
                                // Calculate Distance
                                let distance: string | null = null;
                                if (myCoords && clinic.coordinates) {
                                    const R = 6371;
                                    const dLat = (clinic.coordinates.lat - myCoords.lat) * (Math.PI / 180);
                                    const dLon = (clinic.coordinates.lng - myCoords.lng) * (Math.PI / 180);
                                    const a =
                                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                        Math.cos(myCoords.lat * (Math.PI / 180)) * Math.cos(clinic.coordinates.lat * (Math.PI / 180)) *
                                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                    distance = (R * c).toFixed(1) + ' km';
                                }

                                const isMapExpanded = expandedMapId === clinic.id;

                                return (
                                    <div key={clinic.id}
                                        className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-indigo-400 hover:shadow-lg transition-all duration-300 flex flex-col"
                                    >
                                        {/* ── Branch Photo (top of card) ── */}
                                        <div className="relative w-full h-44 sm:h-48 bg-gray-100 dark:bg-gray-900 overflow-hidden cursor-pointer" onClick={() => handleClinicSelect(clinic)}>
                                            <img
                                                src={getBranchImage(clinic)}
                                                alt={`${clinic.name} interior`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                            {/* Branch name overlay */}
                                            <div className="absolute bottom-3 left-4 right-4">
                                                <h3 className="text-lg font-bold text-white drop-shadow-lg">{clinic.name}</h3>
                                            </div>
                                            {/* Rating badge */}
                                            {clinic.rating && (
                                                <span className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-lg shadow-md">
                                                    {clinic.rating} <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                    <span className="text-gray-500 dark:text-gray-400 font-normal ml-0.5">({clinic.reviewCount})</span>
                                                </span>
                                            )}
                                            {/* Distance badge */}
                                            {distance && (
                                                <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-800/90 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md">
                                                    <Navigation className="w-3 h-3" />
                                                    {distance}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Details Section ── */}
                                        <div className="flex flex-col flex-1 p-5 cursor-pointer" onClick={() => handleClinicSelect(clinic)}>
                                            {/* Contact Details Grid */}
                                            <div className="space-y-2.5 text-sm mb-4">
                                                {/* Address */}
                                                <div className="flex items-start gap-2.5 text-gray-600 dark:text-gray-300">
                                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                                                    <span>{clinic.address}</span>
                                                </div>

                                                {/* Phone */}
                                                {clinic.contactPhone && (
                                                    <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                                                        <Phone className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                                        <a href={`tel:${clinic.contactPhone}`} onClick={e => e.stopPropagation()}
                                                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                            {clinic.contactPhone}
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Email */}
                                                {clinic.email && (
                                                    <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                                                        <Mail className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                                        <a href={`mailto:${clinic.email}`} onClick={e => e.stopPropagation()}
                                                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate">
                                                            {clinic.email}
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Hours */}
                                                {clinic.operationHours && (
                                                    <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                                                        <Clock className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                                        <span>{clinic.operationHours}</span>
                                                    </div>
                                                )}

                                                {/* Parking */}
                                                {clinic.parkingInfo && (
                                                    <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                                                        <Car className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                                                        <span>{clinic.parkingInfo}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Row: View on Maps + Select Branch */}
                                            <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center justify-between text-sm">
                                                    {clinic.locationMap && (
                                                        <a href={clinic.locationMap} target="_blank" rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                            <ExternalLink className="w-3.5 h-3.5" /> View on Maps
                                                        </a>
                                                    )}
                                                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:gap-2 transition-all">
                                                        Select Branch <ArrowRight className="w-4 h-4" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Expandable Map Section ── */}
                                        {clinic.coordinates && (
                                            <div className="border-t border-gray-100 dark:border-gray-700">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedMapId(isMapExpanded ? null : clinic.id);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                >
                                                    <MapIcon className="w-4 h-4" />
                                                    {isMapExpanded ? 'Hide Map' : 'Show Map'}
                                                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMapExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                                <div
                                                    className={`overflow-hidden transition-all duration-400 ease-in-out ${isMapExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
                                                >
                                                    <div className="relative w-full h-56 sm:h-64 bg-gray-100 dark:bg-gray-900">
                                                        {isMapExpanded && (
                                                            <iframe
                                                                width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
                                                                src={clinic.cid
                                                                    ? `https://maps.google.com/maps?cid=${clinic.cid}&hl=en&z=17&output=embed`
                                                                    : `https://maps.google.com/maps?q=${clinic.coordinates.lat},${clinic.coordinates.lng}&hl=en&z=17&output=embed`
                                                                }
                                                                className="w-full h-full" title={`${clinic.name} Map`}
                                                                loading="lazy"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* Step 1: Select Department */}
            {
                step === 1 && selectedClinic && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Change Clinic</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Department</h2>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                            {isLoadingServices ? (
                                <div className="col-span-full text-center py-8">Loading departments...</div>
                            ) : (
                                clinicDepts.map((dept) => (
                                    <button
                                        key={dept.id}
                                        onClick={() => handleDeptSelect(dept)}
                                        className="group overflow-hidden border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all duration-300 text-left"
                                    >
                                        <div className="relative w-full h-36 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                            <img
                                                src={getDeptImage(dept)}
                                                alt={dept.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                            <span className="absolute bottom-2 right-2 bg-white/90 dark:bg-gray-900/90 text-xs font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                {dept.services.length} Services
                                            </span>
                                        </div>
                                        <div className="p-3">
                                            <span className="block font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm">
                                                {dept.name}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )
            }

            {/* Step 2: Select Category */}
            {
                step === 2 && selectedDept && (() => {
                    // Extract unique categories from services, filtered by gender
                    const genderFiltered = selectedDept.services.filter(svc => {
                        if (!svc.allowedGender || svc.allowedGender === 'both') return true;
                        if (user?.gender) return svc.allowedGender === user.gender;
                        return true;
                    });
                    const categoryMap = genderFiltered.reduce((acc, svc) => {
                        const cat = svc.category || 'General Services';
                        if (!acc[cat]) acc[cat] = 0;
                        acc[cat]++;
                        return acc;
                    }, {} as Record<string, number>);
                    const categories = Object.entries(categoryMap);

                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                                <span className="text-gray-300">/</span>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Category</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                {categories.map(([cat, count]) => {
                                    // Use dedicated category image, fallback to first service image in that category
                                    const catImage = categoryImages[cat] || genderFiltered.find(s => (s.category || 'General Services') === cat)?.image;
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => handleCategorySelect(cat)}
                                            className="group overflow-hidden border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all duration-300 text-left"
                                        >
                                            {catImage && (
                                                <div className="relative w-full h-32 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                    <img src={catImage} alt={cat} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                                </div>
                                            )}
                                            <div className={`p-4 ${!catImage ? 'py-6' : ''}`}>
                                                <span className="block font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{cat}</span>
                                                <span className="text-xs text-gray-500 mt-1">{count} Service{count > 1 ? 's' : ''}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Step 3: Select Service (filtered by category + gender) */}
            {
                step === 3 && selectedDept && selectedCategory && (() => {
                    const filteredServices = selectedDept.services
                        .filter(svc => (svc.category || 'General Services') === selectedCategory)
                        .filter(svc => {
                            if (!svc.allowedGender || svc.allowedGender === 'both') return true;
                            if (user?.gender) return svc.allowedGender === user.gender;
                            return true;
                        });

                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                                <span className="text-gray-300">/</span>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Service</h2>
                                <span className="text-sm text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full ml-2">{selectedCategory}</span>
                            </div>
                            <div className="space-y-3">
                                {filteredServices.map((svc) => (
                                    <button
                                        key={svc.id}
                                        onClick={() => handleServiceSelect(svc)}
                                        className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group"
                                    >
                                        {/* Service Thumbnail */}
                                        {svc.image && (
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                                <img src={svc.image} alt={svc.name} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div className="flex-1 text-left min-w-0">
                                            <h4 className="font-semibold text-gray-900 dark:text-white">{svc.name}</h4>
                                            {svc.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{svc.description}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2 text-sm text-gray-500 mt-1">
                                                <span>{svc.duration} mins</span>
                                                {svc.isTaxable && (
                                                    <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-medium">
                                                        +VAT
                                                    </span>
                                                )}
                                                {svc.followUpDuration && (
                                                    <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded font-medium">
                                                        Free Follow Up within {svc.followUpDuration}d
                                                    </span>
                                                )}
                                                {svc.allowedGender && svc.allowedGender !== 'both' && (
                                                    <span className="text-indigo-600 font-medium capitalize">({svc.allowedGender} Only)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{svc.price} AED</span>
                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Screening Questions Modal */}
            {
                showScreening && selectedService && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Health Screening</h3>
                            <p className="text-gray-500 mb-6 text-sm">Please answer the following questions to ensure you are eligible for this service.</p>

                            <div className="space-y-4 mb-6">
                                {selectedService.screeningQuestions?.map((q, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                                        <p className="font-medium text-gray-900 dark:text-white mb-3">{q}</p>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setScreeningAnswers({ ...screeningAnswers, [idx]: true })}
                                                className={`flex-1 py-2 rounded-md border transition-all ${screeningAnswers[idx] === true
                                                    ? 'bg-red-100 border-red-500 text-red-700 font-bold'
                                                    : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                YES
                                            </button>
                                            <button
                                                onClick={() => setScreeningAnswers({ ...screeningAnswers, [idx]: false })}
                                                className={`flex-1 py-2 rounded-md border transition-all ${screeningAnswers[idx] === false
                                                    ? 'bg-green-100 border-green-500 text-green-700 font-bold'
                                                    : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                NO
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {screeningError && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">
                                    {screeningError}
                                </div>
                            )}

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => { setShowScreening(false); setSelectedService(null); }}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleScreeningSubmit}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Medicine Selection Modal */}
            {
                showMedicinePicker && selectedService && (() => {
                    const mode = selectedService.medicineSelectionMode || 'choose';
                    const linkedIds = selectedService.medicineIds || [];
                    const availableMeds = linkedIds.length > 0
                        ? medicineCatalog.filter(m => linkedIds.includes(m.id))
                        : medicineCatalog;
                    const isEither = mode === 'either';

                    return (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg">
                                        <Pill className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {isEither ? 'Choose a Product' : 'Select Medicines'}
                                    </h3>
                                </div>
                                <p className="text-gray-500 mb-4 text-sm">
                                    {isEither
                                        ? `Pick one product for your ${selectedService.name} procedure. The cost will be added to your total.`
                                        : `Choose up to ${selectedService.maxMedicines || availableMeds.length} product${(selectedService.maxMedicines || availableMeds.length) > 1 ? 's' : ''} for your ${selectedService.name} procedure. Any additional cost will be added to your total.`
                                    }
                                </p>

                                {/* Consumables Info Banner */}
                                {(selectedService.consumableIds || []).length > 0 && (
                                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 rounded-lg mb-4">
                                        <div className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">🧴 Consumables included for this procedure:</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(selectedService.consumableIds || []).map(cid => {
                                                const cons = medicineCatalog.find(m => m.id === cid);
                                                return cons ? (
                                                    <span key={cid} className="text-xs bg-orange-100 dark:bg-orange-800/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">{cons.name}</span>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 mb-6">
                                    {availableMeds.map(med => {
                                        const isSelected = selectedMedicineIds.includes(med.id);
                                        const branchQty = (med.branchStock || []).find(b => b.clinicId === selectedClinic?.id)?.quantity || 0;
                                        const outOfStock = branchQty <= 0;
                                        const maxMeds = selectedService.maxMedicines || 0;
                                        const atLimit = !isEither && !isSelected && maxMeds > 0 && selectedMedicineIds.length >= maxMeds;
                                        const isDisabled = outOfStock || atLimit;
                                        return (
                                            <button
                                                key={med.id}
                                                onClick={() => handleMedicineToggle(med.id)}
                                                disabled={isDisabled}
                                                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isSelected
                                                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                                    : isDisabled
                                                        ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 ${isEither ? 'rounded-full' : 'rounded'} border-2 flex items-center justify-center ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-white">{med.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {outOfStock ? (
                                                        <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Out of Stock</span>
                                                    ) : branchQty <= 10 ? (
                                                        <span className="text-xs font-medium text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">{branchQty} left</span>
                                                    ) : null}
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">+{med.price} AED</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedMedicineIds.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-4 flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{selectedMedicineIds.length} product{selectedMedicineIds.length > 1 ? 's' : ''} selected</span>
                                        <span className="font-bold text-teal-600">
                                            +{selectedMedicineIds.reduce((sum, id) => sum + (medicineCatalog.find(m => m.id === id)?.price || 0), 0)} AED
                                        </span>
                                    </div>
                                )}

                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => { setShowMedicinePicker(false); setSelectedMedicineIds([]); setSelectedService(null); }}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleMedicineConfirm}
                                        disabled={isEither && selectedMedicineIds.length === 0}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isEither
                                            ? (selectedMedicineIds.length > 0 ? 'Continue' : 'Select a product')
                                            : (selectedMedicineIds.length > 0 ? 'Continue with Medicines' : 'Skip Medicines')
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Step 4: Select Doctor */}
            {
                step === 4 && selectedDept && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Specialist</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Any Available Doctor option */}
                            <button
                                onClick={() => {
                                    const availableDocs = selectedDept.doctors.filter(doc => !selectedService?.allowedDoctorIds || selectedService.allowedDoctorIds.length === 0 || selectedService.allowedDoctorIds.includes(doc.id));
                                    if (availableDocs.length > 0) {
                                        handleDoctorSelect(availableDocs[0], true);
                                    }
                                }}
                                className="flex items-center gap-4 p-4 border-2 border-dashed border-orange-400 dark:border-orange-500 rounded-xl hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-left sm:col-span-2"
                            >
                                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-orange-600 dark:text-orange-400">Any Available Doctor</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Let the system assign the first available specialist</p>
                                </div>
                            </button>

                            {selectedDept.doctors
                                .filter(doc => !selectedService?.allowedDoctorIds || selectedService.allowedDoctorIds.length === 0 || selectedService.allowedDoctorIds.includes(doc.id))
                                .map((doc) => (
                                    <button
                                        key={doc.id}
                                        onClick={() => handleDoctorSelect(doc)}
                                        className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 transition-all text-left"
                                    >
                                        <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                            <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white">{doc.name}</h4>
                                            <p className="text-sm text-indigo-600 dark:text-indigo-400">{doc.specialty}</p>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                )
            }

            {/* Step 5: Select Date & Time */}
            {
                step === 5 && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(4)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Schedule Appointment</h2>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3">Select Date</h3>
                            {/* Month Navigation */}
                            {datesByMonth.length > 0 && (
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        onClick={() => setCalendarMonthIndex(Math.max(0, calendarMonthIndex - 1))}
                                        disabled={calendarMonthIndex === 0}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="w-5 h-5 rotate-180 text-gray-600 dark:text-gray-300" />
                                    </button>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{currentMonthGroup?.label}</span>
                                    <button
                                        onClick={() => setCalendarMonthIndex(Math.min(datesByMonth.length - 1, calendarMonthIndex + 1))}
                                        disabled={calendarMonthIndex >= datesByMonth.length - 1}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </button>
                                </div>
                            )}
                            {/* Day-of-week header */}
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase">{d}</div>
                                ))}
                            </div>
                            {/* Calendar grid */}
                            {currentMonthGroup && (() => {
                                const firstDate = currentMonthGroup.dates[0];
                                const monthStart = startOfMonth(firstDate);
                                const startDow = monthStart.getDay(); // 0=Sun
                                // Build a set of available day-of-month for quick lookup
                                const availableSet = new Set(currentMonthGroup.dates.map(d => d.getDate()));
                                // Days in this month
                                const daysInMonth = new Date(getYear(firstDate), getMonth(firstDate) + 1, 0).getDate();
                                const cells: (Date | null)[] = [];
                                // Leading empties
                                for (let i = 0; i < startDow; i++) cells.push(null);
                                // Day cells
                                for (let day = 1; day <= daysInMonth; day++) {
                                    if (availableSet.has(day)) {
                                        cells.push(currentMonthGroup.dates.find(d => d.getDate() === day) || null);
                                    } else {
                                        cells.push(null); // unavailable day placeholder
                                    }
                                }
                                return (
                                    <div className="grid grid-cols-7 gap-2">
                                        {cells.map((date, idx) => {
                                            if (!date) {
                                                // Show the day number but disabled
                                                const dayNum = idx - startDow + 1;
                                                if (dayNum >= 1 && dayNum <= daysInMonth) {
                                                    return (
                                                        <div key={`empty-${idx}`} className="p-2 rounded-lg text-center">
                                                            <div className="text-sm text-gray-300 dark:text-gray-600">{dayNum}</div>
                                                        </div>
                                                    );
                                                }
                                                return <div key={`pad-${idx}`} />;
                                            }
                                            const isSelected = selectedDate?.toDateString() === date.toDateString();
                                            return (
                                                <button
                                                    key={date.toISOString()}
                                                    onClick={() => setSelectedDate(date)}
                                                    className={`p-2 rounded-lg border text-center transition-all ${isSelected
                                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                        }`}
                                                >
                                                    <div className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">{format(date, 'EEE')}</div>
                                                    <div className="text-lg font-bold">{format(date, 'd')}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {selectedDate && (
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Available Slots</h3>
                                {isLoadingSlots ? (
                                    <div className="flex justify-center p-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : availableSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                        {availableSlots.map((slot) => (
                                            <button
                                                key={slot}
                                                onClick={() => handleSlotSelect(slot)}
                                                className={`py-2 px-1 text-sm rounded-md border transition-all ${selectedSlot === slot
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-500">No available slots for this date.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Step 6: Review & Confirm */}
            {
                step === 6 && (
                    <div>
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => setStep(5)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                                <span className="text-gray-300">/</span>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Confirm & Pay</h2>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                                <h3 className="font-bold text-lg mb-4 border-b pb-2 dark:border-gray-700">Booking Summary</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-gray-500">Patient</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{user?.name}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Service</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{selectedService?.name}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Doctor</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{selectedDoctor?.name}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Date & Time</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{selectedDate && format(selectedDate, 'MMM d, yyyy')} at {selectedSlot}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Clinic</span>
                                        <span className="font-medium">{selectedClinic?.name}</span>
                                    </div>
                                    {selectedMedicineIds.length > 0 && (
                                        <div className="col-span-2">
                                            <span className="block text-gray-500">Medicines</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {selectedMedicineIds.map(id => {
                                                    const med = medicineCatalog.find(m => m.id === id);
                                                    return med ? (
                                                        <span key={id} className="inline-flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs px-2 py-1 rounded-full">
                                                            <Pill className="w-3 h-3" />
                                                            {med.name} (+{med.price} AED)
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Care Instructions */}
                            {(selectedService?.preCare || selectedService?.postCare) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {selectedService?.preCare && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                                            <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-1.5">
                                                📋 Pre-Procedure Care
                                            </h4>
                                            <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-line">{selectedService.preCare}</p>
                                        </div>
                                    )}
                                    {selectedService?.postCare && (
                                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                                            <h4 className="font-bold text-green-800 dark:text-green-300 text-sm mb-2 flex items-center gap-1.5">
                                                ✅ Post-Procedure Care
                                            </h4>
                                            <p className="text-sm text-green-700 dark:text-green-400 whitespace-pre-line">{selectedService.postCare}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* WhatsApp Number Section */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">WhatsApp Number</label>
                                <input
                                    type="tel"
                                    placeholder="+1234567890"
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                />
                            </div>

                            {/* Referred By Section */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
                                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Referred By</h4>
                                <select
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-3"
                                    value={referredBy}
                                    onChange={(e) => {
                                        setReferredBy(e.target.value as any);
                                        setReferralName(''); setReferralContact(''); setReferralEmployeeName(''); setReferralEmployeeId('');
                                    }}
                                >
                                    <option value="none">None / Not Referred</option>
                                    <option value="family">Family</option>
                                    <option value="friend">Friend</option>
                                    <option value="employee">Employee</option>
                                </select>

                                {referredBy === 'family' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Name *</label>
                                            <input type="text" required placeholder="Referrer's name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralName} onChange={(e) => setReferralName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Contact Number *</label>
                                            <input type="tel" required placeholder="+971..." className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralContact} onChange={(e) => setReferralContact(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {referredBy === 'friend' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Name (Optional)</label>
                                            <input type="text" placeholder="Friend's name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralName} onChange={(e) => setReferralName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Contact (Optional)</label>
                                            <input type="tel" placeholder="+971..." className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralContact} onChange={(e) => setReferralContact(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {referredBy === 'employee' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Employee Name *</label>
                                            <input type="text" required placeholder="Employee full name" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralEmployeeName} onChange={(e) => setReferralEmployeeName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Employee ID Number *</label>
                                            <input type="text" required placeholder="ID number" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={referralEmployeeId} onChange={(e) => setReferralEmployeeId(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Package Redemption Option */}
                            {applicablePackage && (
                                <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer mb-6 flex items-center justify-between ${usePackageSession
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                                    onClick={() => setUsePackageSession(!usePackageSession)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${usePackageSession ? 'border-indigo-600 bg-indigo-600' : 'border-gray-400'}`}>
                                            {usePackageSession && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <PackageIcon className="w-4 h-4 text-indigo-600" />
                                                Use Package Session
                                            </h4>
                                            <p className="text-sm text-gray-500">{applicablePackage.packageName} ({applicablePackage.remainingSessions[selectedService!.id]} sessions remaining)</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-green-600">FREE</span>
                                </div>
                            )}

                            {/* Cost Breakdown */}
                            {!usePackageSession && (
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-6 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>Service ({selectedService?.name})</span>
                                        <span>{basePrice.toFixed(2)} AED</span>
                                    </div>
                                    {medicineTotal > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                            <span>Medicines ({selectedMedicineIds.length})</span>
                                            <span>+{medicineTotal.toFixed(2)} AED</span>
                                        </div>
                                    )}
                                    {vatAmount > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                            <span>VAT ({selectedClinic?.vatPercentage}%)</span>
                                            <span>+{vatAmount.toFixed(2)} AED</span>
                                        </div>
                                    )}
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span>Promo Discount</span>
                                            <span>-{discountAmount.toFixed(2)} AED</span>
                                        </div>
                                    )}
                                    {reviewDiscountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                                                Google Review Discount ({reviewDiscount.percent}%)
                                            </span>
                                            <span>-{reviewDiscountAmount.toFixed(2)} AED</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <span className="text-lg font-medium">Total to Pay</span>
                                        <span className="text-3xl font-bold text-indigo-600">{finalPrice.toFixed(2)} AED</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={usePackageSession ? handlePackageConfirm : handleConfirm}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                            >
                                {usePackageSession ? 'Confirm Booking with Package' : 'Proceed to Payment'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

        </div >
    );
}
