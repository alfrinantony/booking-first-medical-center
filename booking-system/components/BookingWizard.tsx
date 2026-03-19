'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Correct import for App Router
import { clinics as staticClinics, timeSlots, Clinic, Department, Service, Doctor, PromoCode, Medicine, BOOKING_CATEGORIES } from '@/lib/data';
import { useAuthStore } from '@/lib/store';
import CustomerAuth from './auth/CustomerAuth';
import { Calendar, Clock, User, ChevronRight, ChevronDown, Check, MapPin, AlertCircle, Car, ArrowRight, Navigation, Star, Package as PackageIcon, Pill, Phone, Mail, ExternalLink, Map as MapIcon } from 'lucide-react';
import { format, addDays, startOfMonth, getMonth, getYear } from 'date-fns';
import { bookingVoiceController, VOICE_EVENTS, WIZARD_EVENTS, fuzzyMatch, STEP_NAMES } from '@/lib/booking-voice-controller';
import { useFormDraft } from '@/hooks/useFormDraft';

// Default department images (fallback when no Azure Blob URL is set)
const DEPT_IMAGES: Record<string, string> = {
    'Aesthetic Dermatology': '/images/departments/dermatology.png',
    'Laser Hair Removal': '/images/departments/laser.png',
    'Nursing-Beauty Therapy': '/images/departments/nursing.png',
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
    const searchParams = useSearchParams();
    const { user, isAuthenticated } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);
    const [packageAutoSelected, setPackageAutoSelected] = useState(false);

    // API-fetched state for packages and review discount
    const [myPackagesList, setMyPackagesList] = useState<import('@/types/packages').CustomerPackage[]>([]);
    const [reviewDiscountData, setReviewDiscountData] = useState<{ percent: number; reviewedBranches: number; totalBranches: number; hasSubFiveReview: boolean }>({ percent: 0, reviewedBranches: 0, totalBranches: 0, hasSubFiveReview: false });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Fetch packages and review discount data when user is authenticated
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const customerId = user.phone || user.email;
        if (user.phone) {
            fetch(`/api/admin/packages?type=my&phone=${encodeURIComponent(user.phone)}`)
                .then(r => r.json()).then(setMyPackagesList).catch(() => {});
        }
        fetch(`/api/admin/reviews?customerPhone=${encodeURIComponent(customerId)}`)
            .then(r => r.json()).then((reviews: any[]) => {
                const fiveStarBranches = new Set(reviews.filter((r: any) => r.rating === 5).map((r: any) => r.clinicId));
                const hasSubFive = reviews.some((r: any) => r.rating < 5);
                const percent = hasSubFive ? 0 : Math.min(fiveStarBranches.size, 3);
                setReviewDiscountData({ percent, reviewedBranches: fiveStarBranches.size, totalBranches: clinics.length, hasSubFiveReview: hasSubFive });
            }).catch(() => {});
    }, [isAuthenticated, user]);

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

    // Steps: 0: Category, 1: Service, 2: Date, 3: Clinic, 4: Doctor, 5: Time, 6: Confirm
    const [step, setStep] = useState(0);
    const [whatsappNumber, setWhatsappNumber] = useState('');
    // Referral fields
    const [referredBy, setReferredBy] = useState<'none' | 'family' | 'friend' | 'employee'>('none');
    const [referralName, setReferralName] = useState('');
    const [referralContact, setReferralContact] = useState('');
    const [referralEmployeeName, setReferralEmployeeName] = useState('');
    const [referralEmployeeId, setReferralEmployeeId] = useState('');

    const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<any | null>(null); // CatalogService with availability
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [isAnyDoctor, setIsAnyDoctor] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedDeviceGroup, setSelectedDeviceGroup] = useState<string | null>(null);

    // Catalog state (aggregated across all clinics)
    const [catalogData, setCatalogData] = useState<{ categories: string[]; services: any[]; clinics: any[]; schedules?: any[] }>({ categories: [], services: [], clinics: [] });
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [expandedMapId, setExpandedMapId] = useState<string | null>(null);

    // Dynamic slots state
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    // Derive selectedDept from catalog availability (backward compat for rendering)
    const resolvedAvailability = selectedService && selectedClinic
        ? selectedService.availability?.find((a: any) => a.clinicId === selectedClinic.id)
        : null;
    const selectedDept: Department | null = resolvedAvailability
        ? { id: resolvedAvailability.departmentId, name: '', services: [], doctors: resolvedAvailability.doctors || [] } as Department
        : null;
    // Clinics from catalog (full objects for branch selection)
    const clinics = catalogData.clinics.length > 0 ? catalogData.clinics as Clinic[] : staticClinics;

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

    // Fetch user's past bookings for the selected service to determine follow-up eligibility
    React.useEffect(() => {
        if (!user || !selectedService) {
            setIsFollowUp(false);
            setPreviousVisitDate('');
            return;
        }

        const fetchPastBookings = async () => {
            try {
                const res = await fetch(`/api/admin/bookings?search=${encodeURIComponent(user.name)}`);
                if (res.ok) {
                    const bookings = await res.json();
                    // Find ANY booking for this service that isn't cancelled to enforce interval rules against the most recent scheduled date
                    const pastBookings = bookings.filter((b: any) => 
                        b.serviceId === selectedService.id &&
                        b.status !== 'cancelled'
                    );

                    if (pastBookings.length > 0) {
                        pastBookings.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        setPreviousVisitDate(pastBookings[0].date); // This is now actually the LATEST visit date (could be future!)
                        setIsFollowUp(true);
                    } else {
                        setIsFollowUp(false);
                        setPreviousVisitDate('');
                    }
                }
            } catch (err) {
                console.error("Failed to fetch past bookings", err);
            }
        };

        fetchPastBookings();
    }, [user, selectedService]);

    // Fetch booking catalog on mount (aggregated across all clinics)
    React.useEffect(() => {
        const fetchCatalog = async () => {
            setCatalogLoading(true);
            try {
                const res = await fetch('/api/booking-catalog');
                if (res.ok) {
                    const data = await res.json();
                    setCatalogData({
                        ...data,
                        schedules: data.schedules || []
                    });
                }
            } catch (error) {
                console.error('Failed to fetch booking catalog');
            } finally {
                setCatalogLoading(false);
            }
        };
        fetchCatalog();
    }, []);

    // Form Draft Auto-Save
    const currentDraftData = {
        step,
        whatsappNumber,
        referredBy,
        referralName,
        referralContact,
        referralEmployeeName,
        referralEmployeeId,
        selectedClinic,
        selectedCategory,
        selectedService,
        selectedDoctor,
        isAnyDoctor,
        selectedDate: selectedDate ? selectedDate.toISOString() : null,
        selectedSlot,
        selectedMedicineIds,
    };

    const { clearDraft } = useFormDraft('client-booking-wizard', currentDraftData, {
        onRestore: (data: any) => {
            if (data.step !== undefined) setStep(data.step);
            if (data.whatsappNumber !== undefined) setWhatsappNumber(data.whatsappNumber);
            if (data.referredBy !== undefined) setReferredBy(data.referredBy);
            if (data.referralName !== undefined) setReferralName(data.referralName);
            if (data.referralContact !== undefined) setReferralContact(data.referralContact);
            if (data.referralEmployeeName !== undefined) setReferralEmployeeName(data.referralEmployeeName);
            if (data.referralEmployeeId !== undefined) setReferralEmployeeId(data.referralEmployeeId);
            
            if (data.selectedClinic !== undefined) setSelectedClinic(data.selectedClinic);
            if (data.selectedCategory !== undefined) setSelectedCategory(data.selectedCategory);
            if (data.selectedService !== undefined) setSelectedService(data.selectedService);
            if (data.selectedDoctor !== undefined) setSelectedDoctor(data.selectedDoctor);
            if (data.isAnyDoctor !== undefined) setIsAnyDoctor(data.isAnyDoctor);
            if (data.selectedDate) setSelectedDate(new Date(data.selectedDate));
            if (data.selectedSlot !== undefined) setSelectedSlot(data.selectedSlot);
            if (data.selectedMedicineIds !== undefined) setSelectedMedicineIds(data.selectedMedicineIds);
        }
    });

    // Auto-select service from query params OR package
    React.useEffect(() => {
        if (packageAutoSelected || catalogLoading || catalogData.services.length === 0) return;
        
        const qPackageId = searchParams.get('packageId');
        
        const processServiceSelection = async (targetServiceId: string, pkgDetails?: any) => {
            let svc = catalogData.services.find((s: any) => s.id === targetServiceId);
            
            // Fallback: If service is hidden from public catalog, fetch it directly
            if (!svc) {
                try {
                    const res = await fetch(`/api/admin/services?id=${encodeURIComponent(targetServiceId)}`);
                    if (res.ok) {
                        const directService = await res.json();
                        if (directService && directService.id) {
                            // Synthesize availability based on ALL clinics that have this department
                            // This is a rough estimation since we lack the full catalog graph for this hidden item
                            svc = {
                                ...directService,
                                availability: catalogData.clinics.map(c => {
                                    const dept = c.departments.find((d: any) => d.services.some((ds: any) => ds.id === targetServiceId));
                                    if (dept) return { clinicId: c.id, departmentId: dept.id, doctors: dept.doctors };
                                    // If not in catalog, just broadly allow the first dept
                                    return { clinicId: c.id, departmentId: c.departments[0]?.id, doctors: c.departments[0]?.doctors };
                                }).filter(Boolean)
                            };
                        }
                    }
                } catch (e) { console.error('Failed to fetch hidden service'); }
            }

            if (svc) {
                if (step === 0 || step === 1) setStep(2); // Skip straight to dates
                setSelectedCategory(svc.category || 'Package Service');
                setSelectedService(svc);
                setPackageAutoSelected(true);
            }
        };

        if (qPackageId) {
            // Rely on .active instead of strictly paymentStatus='paid' to accommodate legacy data
            const pkg = myPackagesList.find(p => p.id === qPackageId && p.active);
            if (pkg) {
                const availableServiceIds = Object.keys(pkg.remainingSessions).filter(id => pkg.remainingSessions[id] > 0);
                if (availableServiceIds.length > 0) {
                    processServiceSelection(availableServiceIds[0], pkg);
                    return;
                }
            }
        }

        const qServiceId = searchParams.get('serviceId');
        if (qServiceId) {
            processServiceSelection(qServiceId);
        }
    }, [catalogData, catalogLoading, packageAutoSelected, searchParams, myPackagesList, step]);

    // Helper: check if a doctor is available on a specific date, optionally strictly at a given clinic
    const isDoctorAvailableOnDate = (doc: any, date: Date, filterByClinicId?: string): boolean => {
        if (doc.status === 'not_working') return false;
        const dayOfWeek = date.getDay();
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // 1. Basic validation (Status, Employment dates, Global days off)
        if (doc.daysOff && doc.daysOff.includes(dayOfWeek)) return false;
        if (doc.startDate && dateStr < doc.startDate) return false;
        if (doc.endDate && dateStr > doc.endDate) return false;

        // 2. Strict Schedule validation (if Admin has assigned shifts using the Scheduler)
        const allSchedules = catalogData.schedules || [];
        const doctorSchedules = allSchedules.filter((s: any) => s.doctorId === doc.id);

        if (doctorSchedules.length > 0) {
            // The doctor has at least one scheduled shift defined in the system.
            // Strict mode: they MUST have a shift on this specific date (and clinic if provided)
            let matchingSchedules = doctorSchedules.filter((s: any) => s.date === dateStr);
            if (filterByClinicId) {
                matchingSchedules = matchingSchedules.filter((s: any) => s.clinicId === filterByClinicId);
            }
            
            // If there's no shift on this day, or the shift has 0 slots, they are not available
            if (matchingSchedules.length === 0) return false;
            
            // Validate that the matched schedule actually has slots assigned
            const hasSlots = matchingSchedules.some((s: any) => s.slots && s.slots.length > 0);
            if (!hasSlots) return false;
        } else if (filterByClinicId) {
            // No custom schedules exist for this doctor at all.
            // Fall back to: Does this doctor even below to this clinic's department?
            // Technically handled by the department loop already, but we assume true here as a fallback
        }

        return true;
    };

    // Generate next 90 days (3 months) for date selection, filtering by service restrictions only
    // (Clinic and doctor are not yet selected at step 2)
    const availableDates = Array.from({ length: 90 })
        .map((_, i) => addDays(getDubaiNow(), i)) // starts from today (Dubai time)
        .filter(date => {
            const dayOfWeek = date.getDay(); // 0=Sun … 6=Sat

            // Service Restrictions
            if (selectedService?.allowedDays && selectedService.allowedDays.length > 0) {
                if (!selectedService.allowedDays.includes(dayOfWeek)) return false;
            }

            // Interval & Follow-Up Validation
            if (selectedService?.minimumIntervalDays && isFollowUp && previousVisitDate) {
                // Ignore time component for strict date comparison
                const candidateDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const prevStr = previousVisitDate.split('T')[0];
                const prevDateParts = prevStr.split('-');
                const prevDate = new Date(Number(prevDateParts[0]), Number(prevDateParts[1]) - 1, Number(prevDateParts[2]));
                
                const diffTime = candidateDate.getTime() - prevDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                const followUpLimit = selectedService.followUpDuration || 0;
                const minInterval = selectedService.minimumIntervalDays;

                // Rule B & C: blocked if after followUpLimit but before minInterval
                if (diffDays > followUpLimit && diffDays < minInterval) {
                   return false; 
                }
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
                    const clinicParam = selectedClinic ? `&clinicId=${encodeURIComponent(selectedClinic.id)}` : '';
                    const serviceParam = selectedService ? `&serviceId=${encodeURIComponent(selectedService.id)}` : '';
                    const res = await fetch(`/api/admin/schedule?doctorId=${encodeURIComponent(selectedDoctor.id)}&date=${dateStr}${serviceParam}${clinicParam}&t=${Date.now()}`, { cache: 'no-store' });
                    let slots: string[] = []; // Explicit type

                    if (res.ok) {
                        const data = await res.json();
                        // Trust the server's duration-aware response
                        slots = data.slots || [];
                    } else {
                        slots = timeSlots; // Fallback only on API failure
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

                    // 4. Filter out slots that overlap with this patient's existing bookings (duration-aware)
                    if (user?.name) {
                        try {
                            const dateStr2 = format(selectedDate, 'yyyy-MM-dd');
                            const bRes = await fetch(`/api/admin/bookings?date=${dateStr2}&search=${encodeURIComponent(user.name)}`);
                            if (bRes.ok) {
                                const myBookings = await bRes.json();
                                const myActiveBookings = myBookings.filter((b: any) => b.status !== 'cancelled');
                                // Build occupied ranges from patient's bookings
                                slots = slots.filter((slot: string) => {
                                    const candidateStart = parseTimeSlot(slot);
                                    const candidateDur = selectedService?.duration || 30;
                                    const candidateEnd = candidateStart + candidateDur;
                                    return !myActiveBookings.some((b: any) => {
                                        const bStart = parseTimeSlot(b.slot);
                                        const bEnd = bStart + (b.duration || 30);
                                        return candidateStart < bEnd && bStart < candidateEnd;
                                    });
                                });
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

    const handleCategorySelect = (category: string) => {
        setSelectedCategory(category);
        setStep(1); // → Service step
        setSelectedService(null); setSelectedClinic(null); setSelectedDoctor(null);
        setSelectedDate(null); setSelectedSlot(null); setSelectedDeviceGroup(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 0, selected: category });
    };

    const handleClinicSelect = (clinic: any) => {
        setSelectedClinic(clinic);
        
        const qPackageId = searchParams.get('packageId');
        if (qPackageId || packageAutoSelected) {
            const resolved = selectedService?.availability?.find((a: any) => a.clinicId === clinic.id);
            if (resolved && resolved.doctors && resolved.doctors.length > 0) {
                // Find first available doctor for this specific service
                const filteredDoctors = resolved.doctors.filter((doc: any) => {
                    if (selectedService?.allowedDoctorIds && selectedService.allowedDoctorIds.length > 0 && !selectedService.allowedDoctorIds.includes(doc.id)) return false;
                    return true;
                });
                const firstAvailable = filteredDoctors.find((d: any) => selectedDate && isDoctorAvailableOnDate(d, selectedDate, clinic.id)) || filteredDoctors[0];
                
                if (firstAvailable) {
                    setIsAnyDoctor(true);
                    setSelectedDoctor(firstAvailable);
                    setStep(5); // → Skip straight to Time Select
                    setSelectedSlot(null);
                    return;
                }
            }
        }

        setStep(4); // → Doctor step
        setSelectedDoctor(null); setSelectedSlot(null);
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 3, selected: clinic.name });
    };

    // Screening Questions State
    const [showScreening, setShowScreening] = useState(false);
    const [screeningAnswers, setScreeningAnswers] = useState<Record<number, boolean>>({});
    const [screeningError, setScreeningError] = useState<string | null>(null);

    // Determine if service needs medicine step and proceed accordingly
    const proceedAfterScreening = (service: any) => {
        const mode = service.medicineSelectionMode || 'choose';
        const linkedMeds = service.medicineIds || [];
        const hasLinkedMeds = linkedMeds.length > 0;
        const maxMeds = service.maxMedicines || 0;

        if (mode === 'all' && hasLinkedMeds) {
            setSelectedMedicineIds([...linkedMeds]);
            setStep(2); // → Date step
            setSelectedClinic(null); setSelectedDoctor(null);
        } else if (mode === 'either' && hasLinkedMeds) {
            setSelectedMedicineIds([]);
            setShowMedicinePicker(true);
        } else if (mode === 'choose' && (hasLinkedMeds || maxMeds > 0)) {
            setSelectedMedicineIds([]);
            setShowMedicinePicker(true);
        } else {
            setStep(2); // → Date step
            setSelectedClinic(null); setSelectedDoctor(null);
        }
    };

    const handleServiceSelect = (service: any) => {
        if (service.screeningQuestions && service.screeningQuestions.length > 0) {
            setSelectedService(service);
            setShowScreening(true);
            setScreeningAnswers({});
            setScreeningError(null);
        } else {
            setSelectedService(service);
            proceedAfterScreening(service);
        }
        bookingVoiceController.emit(WIZARD_EVENTS.SELECTION_MADE, { step: 1, selected: service.name });
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
        setStep(2); // → Date step
        setSelectedClinic(null); setSelectedDoctor(null);
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
        setSelectedSlot(null);
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
            case 0: // Category selection
                items = catalogData.categories.map(c => ({ id: c, name: c }));
                break;
            case 1: // Service selection
                if (selectedCategory) {
                    items = catalogData.services
                        .filter((s: any) => s.category === selectedCategory)
                        .filter((s: any) => !s.allowedGender || s.allowedGender === 'both' || s.allowedGender === user?.gender)
                        .map((s: any) => ({ id: s.id, name: s.name, price: s.price }));
                }
                break;
            case 2: // Date selection
                items = availableDates.map(d => ({ id: format(d, 'yyyy-MM-dd'), name: format(d, 'EEEE, MMM d') }));
                break;
            case 3: // Clinic selection
                if (selectedService) {
                    const clinicIds = new Set(selectedService.availability?.map((a: any) => a.clinicId) || []);
                    items = clinics.filter(c => clinicIds.has(c.id)).map(c => ({ id: c.id, name: c.name }));
                }
                break;
            case 4: // Doctor selection
                if (selectedDept) items = selectedDept.doctors.map((d: Doctor) => ({ id: d.id, name: d.name }));
                break;
            case 5: // Time slots
                items = availableSlots.map(s => ({ id: s, name: s }));
                break;
        }
        if (items.length > 0) {
            bookingVoiceController.emit(WIZARD_EVENTS.OPTIONS, { step, items });
        }
    }, [step, catalogData, selectedCategory, selectedService, selectedDept, availableDates, availableSlots, user?.gender]);

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

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_CATEGORY, (data: { id: string; name: string }) => {
            if (data.name) handleCategorySelect(data.name);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_SERVICE, (data: { id: string; name: string }) => {
            const svcs = catalogData.services.filter((s: any) => s.category === selectedCategory);
            const svc = svcs.find((s: any) => s.id === data.id) || svcs.find((s: any) => s.name.toLowerCase() === data.name?.toLowerCase());
            if (svc) handleServiceSelect(svc);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_CLINIC, (data: { id: string; name: string }) => {
            const clinic = clinics.find(c => c.id === data.id) || clinics.find(c => c.name.toLowerCase() === data.name?.toLowerCase());
            if (clinic) handleClinicSelect(clinic);
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DOCTOR, (data: { id: string; name: string }) => {
            if (selectedDept) {
                const doc = selectedDept.doctors.find((d: Doctor) => d.id === data.id) || selectedDept.doctors.find((d: Doctor) => d.name.toLowerCase() === data.name?.toLowerCase());
                if (doc) handleDoctorSelect(doc);
            }
        }));

        unsubs.push(bookingVoiceController.on(VOICE_EVENTS.SELECT_DATE, (data: { date: string }) => {
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
    }, [step, catalogData, selectedCategory, selectedDept, availableDates, availableSlots]);

    // Promo Code State
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    // --- Calculated State ---

    // --- Package Logic ---
    const myPackages = myPackagesList;
    const qPackageId = searchParams.get('packageId');
    const applicablePackage = React.useMemo(() => {
        if (qPackageId) {
            const match = myPackages.find(p => p.id === qPackageId && p.active && p.paymentStatus === 'paid');
            if (match) return match;
        }
        if (selectedService) {
            return myPackages.find(p =>
                p.active &&
                p.paymentStatus === 'paid' &&
                p.remainingSessions[selectedService.id] > 0
            ) || null;
        }
        return null;
    }, [qPackageId, selectedService, myPackages]);
    const [usePackageSession, setUsePackageSession] = useState(false);

    // Session tracking calculations
    const packageTotalSessions = applicablePackage && selectedService
        ? (applicablePackage.totalSessions?.[selectedService.id] || applicablePackage.remainingSessions[selectedService.id])
        : 0;
    const packageRemainingSessions = applicablePackage && selectedService
        ? applicablePackage.remainingSessions[selectedService.id]
        : 0;
    const packageCurrentSession = packageTotalSessions - packageRemainingSessions + 1;
    const packageExpiryDate = applicablePackage?.expiryDate
        ? new Date(applicablePackage.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
    const packageDaysLeft = applicablePackage?.expiryDate
        ? Math.max(0, Math.ceil((new Date(applicablePackage.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Auto-select package if available
    useEffect(() => {
        if (applicablePackage) {
            setUsePackageSession(true);
        }
    }, [applicablePackage]);

    // Follow-up Status
    const getFollowUpStatus = () => {
        if (!selectedService?.followUpDuration || !isFollowUp || !previousVisitDate) return null;

        const prev = new Date(previousVisitDate);
        if (isNaN(prev.getTime())) return null;

        const targetDate = selectedDate || new Date();
        const diffTime = Math.abs(targetDate.getTime() - prev.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (prev > targetDate) return { valid: false, message: "Previous date cannot be in the future." };

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
    const reviewDiscount = reviewDiscountData;
    const reviewDiscountAmount = (reviewDiscount.percent > 0 && !isFree) ? priceWithTax * (reviewDiscount.percent / 100) : 0;
    let finalPrice = priceWithTax;
    if (usePackageSession) {
        finalPrice = 0;
    } else if (isFree) {
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
        // If it qualifies as a free follow-up, DO NOT consume a paid package session
        const actuallyConsumePackage = usePackageSession && !isFree;

        // Proceed to Payment
        // In a real app, save booking state/intent ID here
        const bookingData: any = {
            clinicId: selectedClinic?.id,
            deptId: selectedDept?.id,
            serviceId: selectedService?.id,
            doctorId: selectedDoctor?.id,
            date: selectedDate?.toISOString().split('T')[0],
            slot: selectedSlot,
            duration: isFree ? Math.min(selectedService?.duration || 30, 30) : (selectedService?.duration || 30),
            patientName: user?.name || 'Guest',
            patientPhone: user?.phone,
            amount: finalPrice,
            paymentMethod: actuallyConsumePackage ? 'package' : undefined,
            packageId: actuallyConsumePackage ? applicablePackage?.id : undefined,
            isFollowUp: isFree,
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
            // Clear the draft once successfully booked
            await clearDraft();
        } catch (error) {
            console.error('Failed to save booking', error);
            alert('Failed to create booking. Please try again.');
            return;
        }

        if (usePackageSession || finalPrice === 0) {
            router.push('/customer/dashboard');
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



    // handlePackageConfirm was removed to consolidate payload creation and redirect inside handleConfirm


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
                    {['Category', 'Service', 'Date', 'Clinic Branch', 'Doctor', 'Time Slot', 'Review'].map((label, idx) => (
                        <span key={idx} className={step >= idx ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{label}</span>
                    ))}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / 7) * 100}%` }}></div>
                </div>
            </div>



            {/* Step 0: Select Category */}
            {
                step === 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">What are you looking for?</h2>
                        {catalogLoading ? (
                            <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p className="mt-4 text-gray-500">Loading services...</p></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                                {BOOKING_CATEGORIES.map((cat) => {
                                    const catImage = categoryImages[cat];
                                    const count = catalogData.services.filter((s: any) => s.category === cat).length;
                                    const isEmpty = count === 0;
                                    return (
                                        <button key={cat} onClick={() => !isEmpty && handleCategorySelect(cat)}
                                            disabled={isEmpty}
                                            className={`group overflow-hidden border rounded-2xl transition-all duration-300 text-left ${isEmpty
                                                ? 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-lg'
                                            }`}>
                                            <div className="relative w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 overflow-hidden">
                                                {catImage ? (
                                                    <img src={catImage} alt={cat} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-4xl">
                                                        {cat === 'Laser Hair Removal' ? '✨' : cat === 'Face Care' ? '🧖‍♀️' : cat === 'Hair Care' ? '💇' : cat === 'Body Care' ? '🧴' : cat === 'Fillers and Botox' ? '💉' : cat === 'Injectables' ? '💎' : cat === 'Weight Reduction' ? '⚖️' : cat === 'Clinical Dermatology' ? '🩺' : cat === 'IV Fluids' ? '💧' : cat === 'Piercings' ? '👂' : '🏥'}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                                {isEmpty && (
                                                    <div className="absolute top-2 right-2 bg-gray-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Coming soon</div>
                                                )}
                                            </div>
                                            <div className="p-4">
                                                <span className="block font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm">{cat}</span>
                                                <span className="text-xs text-gray-500 mt-1">{isEmpty ? 'No services yet' : `${count} Service${count > 1 ? 's' : ''}`}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Step 1: Select Service (with brand/device sub-step for Laser & Fillers categories) */}
            {
                step === 1 && (selectedCategory || applicablePackage) && (() => {
                    const qPId = searchParams.get('packageId');
                    if (applicablePackage && qPId) {
                        const availableIds = Object.keys(applicablePackage.remainingSessions).filter(id => applicablePackage.remainingSessions[id] > 0);
                        const filteredSvc = catalogData.services.filter((s: any) => availableIds.includes(s.id));
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a service from your package</h2>
                                </div>
                                <div className="space-y-3">
                                    {filteredSvc.map((svc: any) => (
                                        <div key={svc.id} className="border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group overflow-hidden">
                                            <button onClick={() => handleServiceSelect(svc)} className="w-full flex items-center gap-4 p-4 text-left">
                                                {svc.image && (
                                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                                        <img src={svc.image} alt={svc.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">{svc.name}</h4>
                                                    {svc.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{svc.description}</p>}
                                                </div>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    }

                    if (!selectedCategory) return null;

                    const allCatServices = catalogData.services
                        .filter((svc: any) => svc.category === selectedCategory)
                        .filter((svc: any) => {
                            if (!svc.allowedGender || svc.allowedGender === 'both') return true;
                            if (user?.gender) return svc.allowedGender === user.gender;
                            return true;
                        });

                    // Sub-group definitions per category
                    const SUB_GROUPS: Record<string, { title: string; subtitle: string; groups: { key: string; label: string; emoji: string; desc: string; prefix?: string; filter?: (s: any) => boolean }[] }> = {
                        'Laser Hair Removal': {
                            title: 'Choose Device',
                            subtitle: 'We use two premium laser devices. Select your preferred device to see available treatments.',
                            groups: [
                                { key: 'Candela', label: 'Candela GentleMax Pro', emoji: '🔴', desc: 'Dual wavelength Alexandrite & Nd:YAG', prefix: 'Candela-' },
                                { key: 'Lumenis', label: 'Lumenis LightSheer', emoji: '🔵', desc: 'Diode laser technology', prefix: 'Lumenis-' },
                                { key: 'Male', label: 'Male Treatments', emoji: '👨', desc: 'Specialized male hair removal', filter: (s: any) => s.name.startsWith('Male') || s.name === 'Beard' },
                                { key: 'Electrolysis', label: 'Electrolysis', emoji: '⚡', desc: 'Permanent hair removal', filter: (s: any) => s.name.startsWith('Electrolysis') },
                            ]
                        },
                        'Fillers and Botox': {
                            title: 'Choose Procedure',
                            subtitle: 'Select the treatment area. You\'ll then choose your preferred brand and see pricing.',
                            groups: [
                                { key: 'LipsFiller', label: 'Lips Filler', emoji: '👄', desc: 'Lip enhancement & volume', filter: (s: any) => s.name.startsWith('Lips Filler') },
                                { key: 'CheeksFiller', label: 'Cheeks Filler', emoji: '✨', desc: 'Cheek contouring & volume', filter: (s: any) => s.name.startsWith('Cheeks Filler') },
                                { key: 'JawlineFiller', label: 'Jawline Filler', emoji: '💎', desc: 'Jawline definition & sculpting', filter: (s: any) => s.name.startsWith('Jawline Filler') },
                                { key: 'ChinFiller', label: 'Chin Filler', emoji: '🔷', desc: 'Chin reshaping & projection', filter: (s: any) => s.name.startsWith('Chin Filler') },
                                { key: 'UnderEyeFiller', label: 'Under Eye Filler', emoji: '👁️', desc: 'Under-eye hollow correction', filter: (s: any) => s.name.startsWith('Under Eye Filler') },
                                { key: 'NoseFiller', label: 'Nose Filler', emoji: '👃', desc: 'Non-surgical rhinoplasty', filter: (s: any) => s.name.startsWith('Nose Filler') },
                                { key: 'ForeheadBotox', label: 'Forehead Botox', emoji: '💉', desc: 'Forehead line smoothing', filter: (s: any) => s.name.startsWith('Forehead Botox') },
                                { key: 'CrowsFeet', label: "Crow's Feet Botox", emoji: '🌟', desc: "Crow's feet wrinkle reduction", filter: (s: any) => s.name.startsWith("Crow's Feet") },
                                { key: 'FrownLines', label: 'Frown Lines Botox', emoji: '😊', desc: 'Frown line treatment', filter: (s: any) => s.name.startsWith('Frown Lines') },
                                { key: 'FullFaceBotox', label: 'Full Face Botox', emoji: '🎭', desc: 'Complete facial rejuvenation', filter: (s: any) => s.name.startsWith('Full Face Botox') },
                                { key: 'GummySmile', label: 'Gummy Smile Botox', emoji: '😁', desc: 'Gummy smile correction', filter: (s: any) => s.name.startsWith('Gummy Smile') },
                                { key: 'MessoBotox', label: 'Messo Botox', emoji: '💧', desc: 'Meso-botox for skin texture', filter: (s: any) => s.name.startsWith('Messo Botox') },
                            ]
                        },
                        'Injectables': {
                            title: 'Choose Treatment Type',
                            subtitle: 'Select the type of injectable treatment you\'re interested in.',
                            groups: [
                                { key: 'PRP', label: 'PRP Treatments', emoji: '🩸', desc: 'Platelet-Rich Plasma therapy', filter: (s: any) => s.name.startsWith('PRP') },
                                { key: 'IPRF', label: 'IPRF Treatments', emoji: '💉', desc: 'Injectable Platelet-Rich Fibrin', filter: (s: any) => s.name.startsWith('IPRF') },
                                { key: 'Mesotherapy', label: 'Mesotherapy', emoji: '✨', desc: 'Micro-injection rejuvenation', filter: (s: any) => s.name.startsWith('Mesotherapy') },
                                { key: 'SkinBoosters', label: 'Skin Boosters', emoji: '💧', desc: 'Deep hydration & skin quality', filter: (s: any) => s.name.startsWith('Skin Boosters') },
                                { key: 'Polynucleotides', label: 'Polynucleotides', emoji: '🧬', desc: 'Bio-regenerative therapy', filter: (s: any) => s.name.startsWith('Polynucleotides') },
                                { key: 'CollagenStimulators', label: 'Collagen Stimulators', emoji: '🔬', desc: 'Collagen production boosters', filter: (s: any) => s.name.startsWith('Collagen Stimulators') },
                                { key: 'FatDissolving', label: 'Fat Dissolving', emoji: '🔥', desc: 'Non-surgical fat reduction', filter: (s: any) => s.name.startsWith('Fat Dissolving') },
                            ]
                        }
                    };

                    const subGroupConfig = SUB_GROUPS[selectedCategory];
                    const hasSubGroups = !!subGroupConfig;

                    // Filter services by selected sub-group
                    const filteredServices = hasSubGroups && selectedDeviceGroup
                        ? (() => {
                            const group = subGroupConfig.groups.find(g => g.key === selectedDeviceGroup);
                            if (!group) return allCatServices;
                            if (group.filter) return allCatServices.filter(group.filter);
                            return allCatServices.filter((s: any) => s.name.startsWith(group.prefix || ''));
                          })()
                        : allCatServices;

                    // Show sub-group selection if applicable and no group chosen yet
                    if (hasSubGroups && !selectedDeviceGroup) {
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Categories</button>
                                    <span className="text-gray-300">/</span>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{subGroupConfig.title}</h2>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{subGroupConfig.subtitle}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {subGroupConfig.groups.map(group => {
                                        const groupServices = group.filter
                                            ? allCatServices.filter(group.filter)
                                            : allCatServices.filter((s: any) => s.name.startsWith(group.prefix || ''));
                                        return (
                                            <button key={group.key} onClick={() => setSelectedDeviceGroup(group.key)}
                                                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 text-left">
                                                <div className="text-4xl mb-3">{group.emoji}</div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{group.label}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{group.desc}</p>
                                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                    <span className="text-xs text-gray-500">{groupServices.length} treatment{groupServices.length !== 1 ? 's' : ''}</span>
                                                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">View <ArrowRight className="w-4 h-4" /></span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <button onClick={() => { if (hasSubGroups) { setSelectedDeviceGroup(null); } else { setStep(0); } }} className="text-sm text-gray-500 hover:text-indigo-600 underline">
                                    {hasSubGroups ? subGroupConfig.title.replace('Choose ', '') : 'Categories'}
                                </button>
                                <span className="text-gray-300">/</span>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Service</h2>
                                <span className="text-sm text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full ml-2">
                                    {hasSubGroups ? subGroupConfig.groups.find(g => g.key === selectedDeviceGroup)?.label : selectedCategory}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {filteredServices.map((svc: any) => (
                                    <div key={svc.id} className="border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group overflow-hidden">
                                        <button onClick={() => handleServiceSelect(svc)} className="w-full flex items-center gap-4 p-4 text-left">
                                            {svc.image && (
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                                    <img src={svc.image} alt={svc.name} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 dark:text-white">{svc.name}</h4>
                                                {svc.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{svc.description}</p>}
                                                <div className="flex flex-wrap gap-2 text-sm text-gray-500 mt-1">
                                                    <span>{svc.duration} mins</span>
                                                    {svc.isTaxable && <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-medium">+VAT</span>}
                                                    {svc.followUpDuration && <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded font-medium">Free Follow Up within {svc.followUpDuration}d</span>}
                                                    {svc.allowedGender && svc.allowedGender !== 'both' && <span className="text-indigo-600 font-medium capitalize">({svc.allowedGender} Only)</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    {svc.regularPrice && svc.discountedPrice && svc.regularPrice > svc.discountedPrice && (
                                                        <span className="text-xs text-gray-400 line-through">{svc.regularPrice}</span>
                                                    )}
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{svc.discountedPrice || svc.price} AED</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400">per session</span>
                                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                                            </div>
                                        </button>
                                        {/* Session Package Buy Buttons */}
                                        {(svc.threeSessionPackage || svc.sixSessionPackage) && (
                                            <div className="flex gap-2 px-4 pb-4 pt-0">
                                                {svc.threeSessionPackage && (
                                                    <a
                                                        href={`/packages/checkout?serviceId=${svc.id}&serviceName=${encodeURIComponent(svc.name)}&sessions=3&price=${svc.threeSessionPackage.discountedPrice || svc.threeSessionPackage.totalCost}&validity=${svc.threeSessionPackage.validity || 90}&singlePrice=${svc.discountedPrice || svc.price}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-200 dark:border-blue-800"
                                                    >
                                                        📦 Buy 3 Sessions — {svc.threeSessionPackage.discountedPrice || svc.threeSessionPackage.totalCost} AED
                                                    </a>
                                                )}
                                                {svc.sixSessionPackage && (
                                                    <a
                                                        href={`/packages/checkout?serviceId=${svc.id}&serviceName=${encodeURIComponent(svc.name)}&sessions=6&price=${svc.sixSessionPackage.discountedPrice || svc.sixSessionPackage.totalCost}&validity=${svc.sixSessionPackage.validity || 180}&singlePrice=${svc.discountedPrice || svc.price}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800"
                                                    >
                                                        📦 Buy 6 Sessions — {svc.sixSessionPackage.discountedPrice || svc.sixSessionPackage.totalCost} AED
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Step 2: Select Date */}
            {
                step === 2 && selectedService && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Date</h2>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-4 flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            <div>
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">{selectedService.name}</span>
                                <span className="text-xs text-gray-500 ml-2">{selectedService.duration} mins • {selectedService.price} AED</span>
                            </div>
                        </div>

                        {/* Minimum Interval / Follow Up Notice */}
                        {selectedService && isFollowUp && previousVisitDate && (() => {
                            const today = getDubaiNow();
                            const candidateDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            const prevStr = previousVisitDate.split('T')[0];
                            const prevDateParts = prevStr.split('-');
                            const prevDate = new Date(Number(prevDateParts[0]), Number(prevDateParts[1]) - 1, Number(prevDateParts[2]));
                            
                            const diffTime = candidateDate.getTime() - prevDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            const followUpLimit = selectedService.followUpDuration || 0;
                            const minInterval = selectedService.minimumIntervalDays || 0;
                            
                            if (followUpLimit > 0 && diffDays <= followUpLimit) {
                                return (
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-6">
                                        <p className="text-sm text-green-700 dark:text-green-400 font-medium">✨ This appointment is eligible as a follow-up visit and will be scheduled as a free session if booked within {followUpLimit - diffDays} days.</p>
                                    </div>
                                );
                            } else if (minInterval > 0 && diffDays < minInterval) {
                                return (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-6">
                                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">⚠️ Booking blocked: This service requires a minimum interval of {minInterval} days between appointments. Dates before {format(addDays(prevDate, minInterval), 'MMM d, yyyy')} are unavailable.</p>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="mb-6">
                            {datesByMonth.length > 0 && (
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={() => setCalendarMonthIndex(Math.max(0, calendarMonthIndex - 1))} disabled={calendarMonthIndex === 0}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        <ChevronRight className="w-5 h-5 rotate-180 text-gray-600 dark:text-gray-300" />
                                    </button>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{currentMonthGroup?.label}</span>
                                    <button onClick={() => setCalendarMonthIndex(Math.min(datesByMonth.length - 1, calendarMonthIndex + 1))} disabled={calendarMonthIndex >= datesByMonth.length - 1}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase">{d}</div>
                                ))}
                            </div>
                            {currentMonthGroup && (() => {
                                const firstDate = currentMonthGroup.dates[0];
                                const monthStart = startOfMonth(firstDate);
                                const startDow = monthStart.getDay();
                                const availableSet = new Set(currentMonthGroup.dates.map((d: Date) => d.getDate()));
                                const daysInMonth = new Date(getYear(firstDate), getMonth(firstDate) + 1, 0).getDate();
                                const cells: (Date | null)[] = [];
                                for (let i = 0; i < startDow; i++) cells.push(null);
                                for (let day = 1; day <= daysInMonth; day++) {
                                    if (availableSet.has(day)) {
                                        cells.push(currentMonthGroup.dates.find((d: Date) => d.getDate() === day) || null);
                                    } else {
                                        cells.push(null);
                                    }
                                }
                                return (
                                    <div className="grid grid-cols-7 gap-2">
                                        {cells.map((date, idx) => {
                                            if (!date) {
                                                const dayNum = idx - startDow + 1;
                                                if (dayNum >= 1 && dayNum <= daysInMonth) {
                                                    return <div key={`empty-${idx}`} className="p-2 rounded-lg text-center"><div className="text-sm text-gray-300 dark:text-gray-600">{dayNum}</div></div>;
                                                }
                                                return <div key={`pad-${idx}`} />;
                                            }
                                            const isSelected = selectedDate?.toDateString() === date.toDateString();
                                            return (
                                                <button key={date.toISOString()} onClick={() => { setSelectedDate(date); setSelectedClinic(null); setSelectedDoctor(null); setSelectedSlot(null); setStep(3); }}
                                                    className={`p-2 rounded-lg border text-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                                    <div className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">{format(date, 'EEE')}</div>
                                                    <div className="text-lg font-bold">{format(date, 'd')}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )
            }

            {/* Step 3: Select Clinic Branch */}
            {
                step === 3 && selectedService && selectedDate && (() => {
                    const selectedDayOfWeek = selectedDate.getDay();
                    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

                    // Do not filter branches; all branches are displayed, but disabled if they don't offer the service or lack availability
                    const branchOptions = clinics;
                    return (
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                                    <span className="text-gray-300">/</span>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Branch</h2>
                                </div>
                                <button
                                    onClick={() => {
                                        if (navigator.geolocation) {
                                            navigator.geolocation.getCurrentPosition((position) => {
                                                const { latitude, longitude } = position.coords;
                                                setMyCoords({ lat: latitude, lng: longitude });
                                            }, () => {
                                                alert("Unable to retrieve your location. Please ensure location services are enabled.");
                                            });
                                        } else {
                                            alert("Geolocation is not supported by your browser.");
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                >
                                    <Navigation className="w-4 h-4" />
                                    {myCoords ? 'Location Found ✓' : 'Find Nearest Branch'}
                                </button>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-6 flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-indigo-500" />
                                <div>
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{selectedService.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">on {format(selectedDate, 'EEEE, MMM d, yyyy')}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {(() => {
                                    // Process branches and determine their availability status and distance
                                    const branchesWithStatus = branchOptions.map((clinic: any) => {
                                        let distance: string | null = null;
                                        let distValue = 999;
                                        if (myCoords && clinic.coordinates) {
                                            const R = 6371;
                                            const dLat = (clinic.coordinates.lat - myCoords.lat) * (Math.PI / 180);
                                            const dLon = (clinic.coordinates.lng - myCoords.lng) * (Math.PI / 180);
                                            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(myCoords.lat * (Math.PI / 180)) * Math.cos(clinic.coordinates.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                            distValue = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                            distance = distValue.toFixed(1) + ' km';
                                        }

                                        const availability = (selectedService.availability || []).find((a: any) => a.clinicId === clinic.id);
                                        const branchDoctors = availability?.doctors || [];
                                        const allowedDoctorIds = selectedService.allowedDoctorIds;
                                        
                                        const eligibleDoctors = branchDoctors.filter((doc: any) => {
                                            if (allowedDoctorIds && allowedDoctorIds.length > 0 && !allowedDoctorIds.includes(doc.id)) return false;
                                            return isDoctorAvailableOnDate(doc, selectedDate, clinic.id);
                                        });

                                        let isDisabled = false;
                                        let disabledReason = '';
                                        let sortPriority = 0; // 0 = Available, 1 = Try different dates, 2 = Not available
                                        
                                        if (!availability) {
                                            isDisabled = true;
                                            disabledReason = 'This service is not available in this branch.';
                                            sortPriority = 2; // Completely unavailable
                                        } else if (clinic.workingDays && clinic.workingDays.length > 0 && !clinic.workingDays.includes(selectedDayOfWeek)) {
                                            isDisabled = true;
                                            disabledReason = 'Please try different dates.';
                                            sortPriority = 1; // Unavailable on selected date
                                        } else if (eligibleDoctors.length === 0) {
                                            isDisabled = true;
                                            disabledReason = 'Please try different dates.';
                                            sortPriority = 1; // Unavailable on selected date
                                        }

                                        return { ...clinic, distanceStr: distance, distValue, isDisabled, disabledReason, sortPriority };
                                    });

                                    // Sort by Priority first, then by actual distance
                                    const sorted = branchesWithStatus.sort((a: any, b: any) => {
                                        if (a.sortPriority !== b.sortPriority) {
                                            return a.sortPriority - b.sortPriority;
                                        }
                                        return a.distValue - b.distValue;
                                    });

                                    return sorted.map((clinic: any) => {
                                        const { isDisabled, disabledReason, distanceStr: distance, sortPriority } = clinic;
                                        const isMapOpen = expandedMapId === clinic.id;
                                        return (
                                            <div key={clinic.id} className={`group bg-white dark:bg-gray-800 rounded-2xl border ${isDisabled ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-lg'} overflow-hidden transition-all duration-300`}>
                                                {/* Branch Photo */}
                                                <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                                    <img src={getBranchImage(clinic)} alt={clinic.name} className={`w-full h-full object-cover ${!isDisabled ? 'group-hover:scale-105' : 'grayscale'} transition-transform duration-500`} />
                                                </div>
                                                <button onClick={() => !isDisabled && handleClinicSelect(clinic)} disabled={isDisabled} className={`w-full text-left ${isDisabled ? 'cursor-not-allowed' : ''}`}>
                                                    <div className="p-5">
                                                        <div className="flex items-start justify-between">
                                                            <h3 className={`text-lg font-bold ${isDisabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white group-hover:text-indigo-600'} transition-colors`}>{clinic.name}</h3>
                                                            {distance && <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0"><Navigation className="w-3 h-3" />{distance}</span>}
                                                        </div>
                                                        <div className="space-y-2 mt-3 text-sm text-gray-600 dark:text-gray-300">
                                                            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" /><span>{clinic.address}</span></div>
                                                            {clinic.operationHours && <div className="flex items-center gap-2"><Clock className="w-4 h-4 flex-shrink-0 text-indigo-500" /><span>{clinic.operationHours}</span></div>}
                                                            {clinic.contactPhone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 flex-shrink-0 text-indigo-500" /><span>{clinic.contactPhone}</span></div>}
                                                        </div>
                                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                            {clinic.rating && <span className="text-xs font-bold text-yellow-600 flex items-center gap-1">{clinic.rating} <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /></span>}
                                                            {isDisabled ? (
                                                                <span className={`text-xs font-medium px-2 py-1 rounded-md ml-auto text-right leading-tight max-w-[150px] break-words ${sortPriority === 2 ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'}`}>
                                                                    {disabledReason}
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold text-sm ml-auto">Select <ArrowRight className="w-4 h-4" /></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {/* Map toggle + embed */}
                                                <div className="border-t border-gray-100 dark:border-gray-700">
                                                    <button onClick={(e) => { e.stopPropagation(); setExpandedMapId(isMapOpen ? null : clinic.id); }}
                                                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors">
                                                        <MapIcon className="w-3.5 h-3.5" />
                                                        {isMapOpen ? 'Hide Map' : 'View on Map'}
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMapOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    {isMapOpen && clinic.locationMap && (
                                                        <div className="px-3 pb-3">
                                                            <iframe src={clinic.locationMap} className="w-full h-48 rounded-lg border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                                                        </div>
                                                    )}
                                                    {isMapOpen && !clinic.locationMap && clinic.coordinates && (
                                                        <div className="px-3 pb-3">
                                                            <iframe src={`https://www.google.com/maps?q=${clinic.coordinates.lat},${clinic.coordinates.lng}&z=15&output=embed`} className="w-full h-48 rounded-lg border-0" allowFullScreen loading="lazy" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            {branchOptions.length === 0 && (
                                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500">No branches offer this service on the selected date.</p></div>
                            )}
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
                                {selectedService.screeningQuestions?.map((q: string, idx: number) => (
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
                                            {(selectedService.consumableIds || []).map((cid: string) => {
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
                step === 4 && selectedDept && (() => {
                    // Filter doctors by: allowed doctor IDs (ignoring date availability here to show disabled states)
                    const filteredDoctors = selectedDept.doctors.filter((doc: Doctor) => {
                        // Service-level allowed doctor restriction
                        if (selectedService?.allowedDoctorIds && selectedService.allowedDoctorIds.length > 0 && !selectedService.allowedDoctorIds.includes(doc.id)) return false;
                        return true;
                    });
                    
                    const anyDoctorAvailable = selectedDate ? filteredDoctors.some((doc: Doctor) => isDoctorAvailableOnDate(doc, selectedDate, selectedClinic?.id)) : false;

                    return (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Specialist</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Any Available Doctor option */}
                            {filteredDoctors.length > 0 && (
                            <button
                                disabled={!anyDoctorAvailable}
                                onClick={() => {
                                    if (anyDoctorAvailable) {
                                        handleDoctorSelect(filteredDoctors.find((d: Doctor) => isDoctorAvailableOnDate(d, selectedDate!, selectedClinic?.id)) || filteredDoctors[0], true);
                                    }
                                }}
                                className={`flex items-center justify-between p-4 border-2 border-dashed ${!anyDoctorAvailable ? 'border-gray-300 dark:border-gray-600 opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : 'border-orange-400 dark:border-orange-500 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'} rounded-xl transition-all text-left sm:col-span-2`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 ${!anyDoctorAvailable ? 'bg-gray-200 dark:bg-gray-700' : 'bg-orange-100 dark:bg-orange-900/30'} rounded-full flex items-center justify-center flex-shrink-0`}>
                                        <svg className={`w-8 h-8 ${!anyDoctorAvailable ? 'text-gray-400 dark:text-gray-500' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${!anyDoctorAvailable ? 'text-gray-500 dark:text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>Any Available Doctor</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Let the system assign the first available specialist</p>
                                    </div>
                                </div>
                                {!anyDoctorAvailable && (
                                    <div className="sm:text-right hidden sm:block">
                                        <span className="block text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">No availability on selected date</span>
                                        <span className="block text-[10px] text-gray-500 mt-1">Select another day</span>
                                    </div>
                                )}
                            </button>
                            )}

                            {filteredDoctors.map((doc) => {
                                const isAvailable = selectedDate ? isDoctorAvailableOnDate(doc, selectedDate, selectedClinic?.id) : false;
                                return (
                                    <button
                                        key={doc.id}
                                        disabled={!isAvailable}
                                        onClick={() => isAvailable && handleDoctorSelect(doc)}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border ${!isAvailable ? 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500 bg-white dark:bg-gray-800'} rounded-xl transition-all text-left gap-4`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                                <img src={doc.image} alt={doc.name} className={`w-full h-full object-cover ${!isAvailable ? 'grayscale opacity-70' : ''}`} />
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${!isAvailable ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{doc.name}</h4>
                                                <p className={`text-sm ${!isAvailable ? 'text-gray-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{doc.specialty}</p>
                                            </div>
                                        </div>
                                        {!isAvailable && (
                                            <div className="sm:text-right hidden sm:block">
                                                <span className="block text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">Unavailable on selected date</span>
                                                <span className="block text-[10px] text-gray-500 mt-1">Select another day</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                            {filteredDoctors.length === 0 && (
                                <div className="sm:col-span-2 text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500">No specialists are available on this date. Please go back and try a different date.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    );
                })()
            }

            {/* Step 5: Select Time Slot */}
            {
                step === 5 && selectedDate && (
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <button onClick={() => setStep(4)} className="text-sm text-gray-500 hover:text-indigo-600 underline">Back</button>
                            <span className="text-gray-300">/</span>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Time Slot</h2>
                        </div>

                        {/* Inline Date Switcher */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Date:</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                                {availableDates.slice(0, 14).map((date) => {
                                    const isActive = selectedDate?.toDateString() === date.toDateString();
                                    return (
                                        <button key={date.toISOString()} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                                            className={`flex-shrink-0 px-3 py-2 rounded-lg border text-center transition-all min-w-[70px] ${
                                                isActive
                                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}>
                                            <div className="text-[10px] uppercase font-bold opacity-80">{format(date, 'EEE')}</div>
                                            <div className="text-sm font-bold">{format(date, 'd MMM')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Available times for {format(selectedDate, 'EEEE, MMM d')}</h3>
                            {/* Duration info badge */}
                            {selectedService?.duration && (
                                <div className="flex items-center gap-2 mb-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
                                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                                        This service takes {selectedService.duration} minutes. Slots that cannot fit the full duration are hidden.
                                    </span>
                                </div>
                            )}
                            {isLoadingSlots ? (
                                <div className="flex justify-center p-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {availableSlots.map((slot) => {
                                        // Compute end time display
                                        const dur = selectedService?.duration || 30;
                                        const [time, period] = slot.split(' ');
                                        let [h, m] = time.split(':').map(Number);
                                        if (period === 'PM' && h !== 12) h += 12;
                                        if (period === 'AM' && h === 12) h = 0;
                                        const endTotalMins = h * 60 + m + dur;
                                        let endH = Math.floor(endTotalMins / 60);
                                        const endM = endTotalMins % 60;
                                        const endPeriod = endH >= 12 ? 'PM' : 'AM';
                                        if (endH > 12) endH -= 12;
                                        if (endH === 0) endH = 12;
                                        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endPeriod}`;
                                        return (
                                            <button key={slot} onClick={() => handleSlotSelect(slot)}
                                                className={`py-2.5 px-2 text-sm rounded-lg border transition-all font-medium ${
                                                    selectedSlot === slot
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}>
                                                <span>{slot}</span>
                                                <span className={`block text-[10px] mt-0.5 ${selectedSlot === slot ? 'text-indigo-200' : 'text-gray-400'}`}>→ {endTime}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500">No available slots for this date. Try another date above.</p>
                                </div>
                            )}
                        </div>
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
                                        {selectedService?.duration && selectedSlot && (() => {
                                            const dur = isFree ? Math.min(selectedService.duration, 30) : selectedService.duration;
                                            const [time, period] = selectedSlot.split(' ');
                                            let [h, m] = time.split(':').map(Number);
                                            if (period === 'PM' && h !== 12) h += 12;
                                            if (period === 'AM' && h === 12) h = 0;
                                            const endTotalMins = h * 60 + m + dur;
                                            let endH = Math.floor(endTotalMins / 60);
                                            const endM = endTotalMins % 60;
                                            const endPeriod = endH >= 12 ? 'PM' : 'AM';
                                            if (endH > 12) endH -= 12;
                                            if (endH === 0) endH = 12;
                                            const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endPeriod}`;
                                            return <span className="block text-xs text-indigo-500 mt-0.5">Duration: {dur} min (ends at {endTime})</span>;
                                        })()}
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
                                <div className={`rounded-xl border-2 transition-all cursor-pointer mb-6 overflow-hidden ${usePackageSession
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                                    onClick={() => setUsePackageSession(!usePackageSession)}
                                >
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${usePackageSession ? 'border-indigo-600 bg-indigo-600' : 'border-gray-400'}`}>
                                                {usePackageSession && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    <PackageIcon className="w-4 h-4 text-indigo-600" />
                                                    Use Package Session
                                                </h4>
                                                <p className="text-sm text-gray-500">{applicablePackage.packageName}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-green-600">FREE</span>
                                    </div>
                                    {/* Session tracking details */}
                                    {usePackageSession && (
                                        <div className="px-4 pb-4 pt-0">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                                                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Current Session</p>
                                                        <p className="text-lg font-extrabold text-indigo-600">{packageCurrentSession} <span className="text-sm font-normal text-gray-400">of {packageTotalSessions}</span></p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Remaining</p>
                                                        <p className="text-lg font-extrabold text-emerald-600">{packageRemainingSessions - 1} <span className="text-sm font-normal text-gray-400">sessions</span></p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Expires</p>
                                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{packageExpiryDate}</p>
                                                        <p className="text-xs text-gray-400">{packageDaysLeft} days left</p>
                                                    </div>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${((packageCurrentSession) / packageTotalSessions) * 100}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1 text-center">
                                                    {packageCurrentSession - 1} of {packageTotalSessions} sessions used
                                                </p>
                                            </div>
                                        </div>
                                    )}
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
                                onClick={handleConfirm}
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
