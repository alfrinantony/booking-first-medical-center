'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Correct import for App Router
import { clinics, timeSlots, Clinic, Department, Service, Doctor, PromoCode, Medicine } from '@/lib/data';
import { useAuthStore } from '@/lib/store';
import { usePackagesStore } from '@/lib/packages-store';
import CustomerAuth from './auth/CustomerAuth';
import { Calendar, Clock, User, ChevronRight, Check, MapPin, AlertCircle, Car, ArrowRight, Navigation, Star, Package as PackageIcon, Pill } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { bookingVoiceController, VOICE_EVENTS, WIZARD_EVENTS, fuzzyMatch, STEP_NAMES } from '@/lib/booking-voice-controller';

export default function BookingWizard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const { getMyPackages, useSession } = usePackagesStore();
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

    // Steps: 0: Clinic, 1: Dept, 2: Service, 3: Doctor, 4: Date/Time, 5: Confirm
    const [step, setStep] = useState(0);
    const [whatsappNumber, setWhatsappNumber] = useState('');

    const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Dynamic slots state
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    // Dynamic Services State
    const [clinicDepts, setClinicDepts] = useState<Department[]>([]);
    const [isLoadingServices, setIsLoadingServices] = useState(false);

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

    // Generate next 14 days for date selection, filtering by service.allowedDays AND clinic.workingDays
    const availableDates = Array.from({ length: 14 })
        .map((_, i) => addDays(new Date(), i + 1))
        .filter(date => {
            // Service Restrictions
            if (selectedService?.allowedDays && selectedService.allowedDays.length > 0) {
                if (!selectedService.allowedDays.includes(date.getDay())) return false;
            }
            // Clinic Restrictions
            if (selectedClinic?.workingDays && selectedClinic.workingDays.length > 0) {
                if (!selectedClinic.workingDays.includes(date.getDay())) return false;
            }
            return true;
        });

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
        setSelectedDept(null); setSelectedService(null); setSelectedDoctor(null);
    };

    const handleDeptSelect = (dept: Department) => {
        setSelectedDept(dept);
        setStep(2);
        setSelectedService(null); setSelectedDoctor(null);
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
            setStep(3);
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
            setStep(3);
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
        setStep(3);
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
            setStep(3);
            setSelectedDoctor(null);
        }
    };

    const handleDoctorSelect = (doc: Doctor) => {
        setSelectedDoctor(doc);
        setStep(4);
        setSelectedDate(null); setSelectedSlot(null);
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
    }

    const handleSlotSelect = (slot: string) => {
        setSelectedSlot(slot);
        setStep(5);
    };

    /* ── Voice Controller Integration ── */
    // Emit available options to the voice agent whenever the step changes
    useEffect(() => {
        bookingVoiceController.emit(WIZARD_EVENTS.STEP_CHANGED, { step, stepName: STEP_NAMES[step] || 'Unknown' });

        let items: { id: string; name: string }[] = [];
        switch (step) {
            case 0: // Clinic selection
                items = clinics.map(c => ({ id: c.id, name: c.name }));
                break;
            case 1: // Department selection
                items = clinicDepts.map(d => ({ id: d.id, name: d.name }));
                break;
            case 2: // Service selection
                if (selectedDept) items = selectedDept.services.map(s => ({ id: s.id, name: s.name }));
                break;
            case 3: // Doctor selection
                if (selectedDept) items = selectedDept.doctors.map(d => ({ id: d.id, name: d.name }));
                break;
            case 4: // Date/Time
                items = availableDates.map(d => ({ id: format(d, 'yyyy-MM-dd'), name: format(d, 'EEEE, MMM d') }));
                break;
        }
        if (items.length > 0) {
            bookingVoiceController.emit(WIZARD_EVENTS.OPTIONS, { step, items });
        }
    }, [step, clinicDepts, selectedDept, availableDates]);

    // Emit slot options when available
    useEffect(() => {
        if (step === 4 && availableSlots.length > 0) {
            bookingVoiceController.emit(WIZARD_EVENTS.OPTIONS, {
                step: 4,
                items: availableSlots.map(s => ({ id: s, name: s })),
            });
        }
    }, [step, availableSlots]);

    // Subscribe to voice commands
    useEffect(() => {
        const unsubs: (() => void)[] = [];

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_CLINIC, (data: { id: string; name: string }) => {
            const clinic = clinics.find(c => c.id === data.id);
            if (clinic) handleClinicSelect(clinic);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DEPT, (data: { id: string; name: string }) => {
            const dept = clinicDepts.find(d => d.id === data.id);
            if (dept) handleDeptSelect(dept);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_SERVICE, (data: { id: string; name: string }) => {
            if (selectedDept) {
                const svc = selectedDept.services.find(s => s.id === data.id);
                if (svc) handleServiceSelect(svc);
            }
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DOCTOR, (data: { id: string; name: string }) => {
            if (selectedDept) {
                const doc = selectedDept.doctors.find(d => d.id === data.id);
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
            if (step === 5) handleConfirm();
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
    const basePrice = selectedService?.price || 0;
    const medicineTotal = selectedMedicineIds.reduce((sum, id) => {
        const med = medicineCatalog.find(m => m.id === id);
        return sum + (med?.price || 0);
    }, 0);
    const vatAmount = (selectedService?.isTaxable && selectedClinic?.vatPercentage)
        ? basePrice * (selectedClinic.vatPercentage / 100)
        : 0;
    const priceWithTax = basePrice + vatAmount + medicineTotal;

    // Final Price with Discounts
    let finalPrice = priceWithTax;
    if (isFree) {
        finalPrice = 0;
    } else if (appliedPromo) {
        finalPrice = Math.max(0, priceWithTax - discountAmount);
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
        const bookingData = {
            clinicId: selectedClinic?.id,
            deptId: selectedDept?.id,
            serviceId: selectedService?.id,
            doctorId: selectedDoctor?.id,
            date: selectedDate?.toISOString().split('T')[0],
            slot: selectedSlot,
            patientName: 'John Doe', // Mock patient name for now, or get from Auth context
            amount: finalPrice, // Use final discounted price
            promoCode: appliedPromo?.code,
            whatsappNumber: whatsappNumber,
            selectedMedicineIds: selectedMedicineIds.length > 0 ? selectedMedicineIds : undefined
        };

        try {
            // Persist booking
            await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
        } catch (error) {
            console.error('Failed to save booking', error);
        }

        // Store in URL params or context for the payment page
        const query = new URLSearchParams({
            amount: String(finalPrice.toFixed(2)),
            serviceName: selectedService?.name || '',
            bookingId: 'mock-booking-id-' + Date.now(),
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
            const bookingData = {
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
                whatsappNumber: whatsappNumber
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

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg my-12">

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {['Clinic', 'Department', 'Service', 'Doctor', 'Time', 'Review'].map((label, idx) => (
                        <span key={idx} className={step >= idx ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{label}</span>
                    ))}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / 6) * 100}%` }}></div>
                </div>
            </div>



            {/* Step 0: Select Clinic */}
            {
                step === 0 && (
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a Clinic</h2>
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
                                className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                            >
                                <Navigation className="w-4 h-4" />
                                Show Distance from Me
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {clinics.map((clinic) => {
                                // Calculate Distance if User Location is available
                                let distance: string | null = null;
                                if (myCoords && clinic.coordinates) {
                                    // Haversine Formula
                                    const R = 6371; // Radius of the earth in km
                                    const dLat = (clinic.coordinates.lat - myCoords.lat) * (Math.PI / 180);
                                    const dLon = (clinic.coordinates.lng - myCoords.lng) * (Math.PI / 180);
                                    const a =
                                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                        Math.cos(myCoords.lat * (Math.PI / 180)) * Math.cos(clinic.coordinates.lat * (Math.PI / 180)) *
                                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                    const d = R * c; // Distance in km
                                    distance = d.toFixed(1) + ' km';
                                }

                                return (
                                    <div key={clinic.id} className="relative group h-full">
                                        <button
                                            onClick={() => handleClinicSelect(clinic)}
                                            className="w-full h-full p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left flex flex-col"
                                        >
                                            <div className="flex items-start justify-between w-full mb-4">
                                                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg">
                                                    <MapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                {distance && (
                                                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                                        <Navigation className="w-3 h-3" />
                                                        {distance}
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{clinic.name}</h3>

                                            {/* Rating */}
                                            {clinic.rating && (
                                                <div className="flex items-center gap-1 mb-2">
                                                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        {clinic.rating} <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        ({clinic.reviewCount} Google reviews)
                                                    </span>
                                                </div>
                                            )}

                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{clinic.address}</p>

                                            <div className="mt-auto space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800 w-full">
                                                {clinic.operationHours && (
                                                    <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                        <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                        <span className="line-clamp-2">{clinic.operationHours}</span>
                                                    </div>
                                                )}
                                                {clinic.parkingInfo && (
                                                    <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                        <Car className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                        <span className="line-clamp-1">{clinic.parkingInfo}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>



                                        {clinic.coordinates && (
                                            <div className="w-full h-48 mt-4 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 relative z-0 shadow-inner">
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    frameBorder="0"
                                                    scrolling="no"
                                                    marginHeight={0}
                                                    marginWidth={0}
                                                    src={clinic.cid
                                                        ? `https://maps.google.com/maps?cid=${clinic.cid}&hl=en&z=17&output=embed`
                                                        : `https://maps.google.com/maps?q=${clinic.coordinates.lat},${clinic.coordinates.lng}&hl=en&z=17&output=embed`
                                                    }
                                                    className="w-full h-full"
                                                    title={`${clinic.name} Map`}
                                                >
                                                </iframe>
                                                {/* Overlay to prevent map interaction from interfering with card click */}
                                                <div className="absolute inset-0 bg-transparent pointer-events-none"></div>
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

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {isLoadingServices ? (
                                <div className="col-span-full text-center py-8">Loading departments...</div>
                            ) : (
                                clinicDepts.map((dept) => (
                                    <button
                                        key={dept.id}
                                        onClick={() => handleDeptSelect(dept)}
                                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                                    >
                                        <span className="block font-medium text-gray-800 dark:text-gray-200">{dept.name}</span>
                                        <span className="text-xs text-gray-500">{dept.services.length} Services</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )
            }

            {/* Step 2: Select Service */}
            {
                step === 2 && selectedDept && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Service</h2>
                        </div>
                        <div className="space-y-6">
                            {Object.entries(
                                selectedDept.services
                                    .filter(svc => {
                                        if (!svc.allowedGender || svc.allowedGender === 'both') return true;
                                        if (user?.gender) return svc.allowedGender === user.gender;
                                        return true;
                                    })
                                    .reduce((acc, service) => {
                                        const cat = service.category || 'General Services';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(service);
                                        return acc;
                                    }, {} as Record<string, Service[]>)
                            ).map(([category, services]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 ml-1">{category}</h3>
                                    <div className="space-y-3">
                                        {services.map((svc) => (
                                            <button
                                                key={svc.id}
                                                onClick={() => handleServiceSelect(svc)}
                                                className="w-full flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 transition-all group"
                                            >
                                                <div className="text-left">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">{svc.name}</h4>
                                                    <div className="flex gap-2 text-sm text-gray-500">
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
                                                <div className="flex items-center gap-4">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{svc.price} AED</span>
                                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
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

            {/* Step 3: Select Doctor */}
            {
                step === 3 && selectedDept && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Specialist</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

            {/* Step 4: Select Date & Time */}
            {
                step === 4 && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Schedule Appointment</h2>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3">Select Date</h3>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {availableDates.map((date) => (
                                    <button
                                        key={date.toISOString()}
                                        onClick={() => setSelectedDate(date)}
                                        className={`min-w-[80px] p-3 rounded-lg border text-center transition-all ${selectedDate?.toDateString() === date.toDateString()
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="text-xs uppercase font-bold text-gray-500">{format(date, 'EEE')}</div>
                                        <div className="text-xl font-bold">{format(date, 'd')}</div>
                                    </button>
                                ))}
                            </div>
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

            {/* Step 5: Confirmation & Auth */}
            {
                step === 5 && (
                    <div>
                        {!isAuthenticated ? (
                            <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-center">Please Log In to Complete Booking</h2>
                                <CustomerAuth />
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-2 mb-6">
                                    <button onClick={() => setStep(4)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
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
                                                <span>Discount</span>
                                                <span>-{discountAmount.toFixed(2)} AED</span>
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
                        )}
                    </div>
                )}

        </div >
    );
}
