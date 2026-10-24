'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft, Check, Edit3, Eye, FileText, Download } from 'lucide-react';

function AgreementContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Editable or query-populated fields
    const [patientName, setPatientName] = useState(searchParams.get('name') || '');
    const [dob, setDob] = useState(searchParams.get('dob') || '');
    const [fileNo, setFileNo] = useState(searchParams.get('fileNo') || '');
    const [telephone, setTelephone] = useState(searchParams.get('phone') || '');
    const [purchaseDate, setPurchaseDate] = useState(searchParams.get('purchaseDate') || new Date().toISOString().split('T')[0]);
    const [purchaseAmount, setPurchaseAmount] = useState(searchParams.get('amount') || '');
    const [receiptNumber, setReceiptNumber] = useState(searchParams.get('receipt') || '');
    const [startDate, setStartDate] = useState(searchParams.get('startDate') || new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState(searchParams.get('expiryDate') || '');
    const [term, setTerm] = useState(searchParams.get('term') || '1 Year (365 Days)');
    const [membershipName, setMembershipName] = useState(searchParams.get('membership') || 'HER Care Essential');

    // Treatments
    const [treatment1, setTreatment1] = useState('Laser Hair Removal');
    const [treatment2, setTreatment2] = useState('PRP Hair Injection');
    const [treatment3, setTreatment3] = useState('HydraFacial Classic');

    // Signatures / Staff
    const [staffName, setStaffName] = useState(searchParams.get('staff') || '');

    useEffect(() => {
        const stored = sessionStorage.getItem('adminUser');
        if (stored && !staffName) {
            try {
                const u = JSON.parse(stored);
                if (u.name) setStaffName(u.name);
            } catch (e) {}
        }
    }, [staffName]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-4 sm:px-6 print:p-0 print:bg-white print:m-0">
            {/* Top Toolbar (Hidden when printing) */}
            <div className="max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Memberships
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-600" />
                            Patient Agreement & Acknowledgement (EN / AR)
                        </h2>
                        <p className="text-[11px] text-slate-500">
                            Strict 1-Page Side-by-Side Bilingual Agreement for Medical Membership Clients
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => {
                            if (!patientName) {
                                setPatientName('Amina Al Mansoori');
                                setDob('1994-08-14');
                                setFileNo('FMC-2026-884');
                                setTelephone('+971 50 123 4567');
                                setPurchaseAmount('AED 4,200 (inc. 5% VAT)');
                                setReceiptNumber('REC-2026-092');
                                setExpiryDate('2027-10-24');
                                setStaffName('Dr. Sarah Al Zaabi');
                            } else {
                                setPatientName('');
                                setDob('');
                                setFileNo('');
                                setTelephone('');
                                setPurchaseAmount('');
                                setReceiptNumber('');
                                setExpiryDate('');
                            }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        {patientName ? 'Clear to Blank Template' : 'Fill Sample Client'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-2 transition-all"
                    >
                        <Printer className="w-4 h-4" />
                        Print / Save 1-Page PDF
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SINGLE PAGE PRINT CONTAINER (A4 / Letter Optimized)
               ══════════════════════════════════════════════════════════ */}
            <div className="max-w-[210mm] mx-auto bg-white text-slate-900 shadow-xl print:shadow-none print:w-full print:max-w-none print:m-0 rounded-none border border-slate-200 print:border-none p-4 sm:p-5 print:p-2.5 text-[8.5px] leading-[1.25]">
                {/* Clinic Header */}
                <div className="border-b border-slate-300 pb-1.5 mb-1.5 flex justify-between items-center">
                    <div>
                        <h1 className="text-xs font-black tracking-wide text-slate-900 uppercase">
                            FIRST MEDICAL CENTER LLC
                        </h1>
                        <p className="text-[7.5px] text-slate-500 tracking-wider">
                            DUBAI &bull; UNITED ARAB EMIRATES &bull; CLINICAL LICENSED FACILITY
                        </p>
                    </div>
                    <div className="text-right" dir="rtl">
                        <h1 className="text-xs font-black tracking-wide text-slate-900">
                            مركز فيرست الطبي ذ.م.م
                        </h1>
                        <p className="text-[7.5px] text-slate-500">
                            دبي &bull; الإمارات العربية المتحدة &bull; منشأة طبية مرخصة
                        </p>
                    </div>
                </div>

                {/* Document Main Title (Bilingual) */}
                <div className="text-center bg-slate-100 py-1 px-2 rounded mb-1.5 border border-slate-200">
                    <div className="flex justify-between items-center px-1">
                        <span className="font-extrabold uppercase tracking-wide text-slate-900 text-[10.5px]">
                            PATIENT AGREEMENT AND ACKNOWLEDGEMENT
                        </span>
                        <span className="font-extrabold text-slate-900 text-[11px]" dir="rtl">
                            اتفاقية وإقرار المريض
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[7.5px] leading-tight text-slate-600 mt-0.5 pt-0.5 border-t border-slate-200 text-left">
                        <p>
                            This form records the membership purchased and the conditions for using it. Read all the pages and complete all membership details before signing. This agreement does not replace medical assessment or procedure specific informed consent.
                        </p>
                        <p dir="rtl" className="text-right">
                            يسجل هذا النموذج العضوية المشتراة وشروط استخدامها. يُرجى قراءة كافة التفاصيل واستكمال جميع بيانات العضوية قبل التوقيع. لا تحل هذه الاتفاقية محل التقييم الطبي السريري أو الموافقة المستنيرة الخاصة بكل إجراء طبي.
                        </p>
                    </div>
                </div>

                {/* Membership Title & Patient Details Grid */}
                <div className="border border-slate-300 rounded p-1.5 mb-1.5 bg-slate-50/60">
                    <div className="flex justify-between items-center border-b border-slate-300 pb-1 mb-1 font-bold text-[9px] text-indigo-950">
                        <span>&ldquo;{membershipName}&rdquo; Membership and patient details</span>
                        <span dir="rtl">تفاصيل عضوية &ldquo;{membershipName}&rdquo; وبيانات المريضة</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px]">
                        {/* Name */}
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5">
                            <span className="text-slate-500 font-semibold">Name:</span>
                            <span className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-2">
                                {patientName || '___________________________'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5" dir="rtl">
                            <span className="text-slate-500 font-semibold">الاسم:</span>
                            <span className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-2">
                                {patientName || '___________________________'}
                            </span>
                        </div>

                        {/* DOB & File No */}
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5">
                            <span className="text-slate-500">Date of birth: <strong className="text-slate-900 font-semibold">{dob || '__________'}</strong></span>
                            <span className="text-slate-500">File No: <strong className="text-slate-900 font-semibold">{fileNo || '______'}</strong></span>
                        </div>
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5" dir="rtl">
                            <span className="text-slate-500">تاريخ الميلاد: <strong className="text-slate-900 font-semibold">{dob || '__________'}</strong></span>
                            <span className="text-slate-500">رقم الملف: <strong className="text-slate-900 font-semibold">{fileNo || '______'}</strong></span>
                        </div>

                        {/* Telephone & Purchase Date */}
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5">
                            <span className="text-slate-500">Telephone: <strong className="text-slate-900 font-semibold">{telephone || '_____________'}</strong></span>
                            <span className="text-slate-500">Purchase date: <strong className="text-slate-900 font-semibold">{purchaseDate || '__________'}</strong></span>
                        </div>
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5" dir="rtl">
                            <span className="text-slate-500">الهاتف: <strong className="text-slate-900 font-semibold">{telephone || '_____________'}</strong></span>
                            <span className="text-slate-500">تاريخ الشراء: <strong className="text-slate-900 font-semibold">{purchaseDate || '__________'}</strong></span>
                        </div>

                        {/* Amount & Receipt */}
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5">
                            <span className="text-slate-500">Purchase Amount: <strong className="text-slate-900 font-semibold">{purchaseAmount || '_____________'}</strong></span>
                            <span className="text-slate-500">Receipt No: <strong className="text-slate-900 font-semibold">{receiptNumber || '__________'}</strong></span>
                        </div>
                        <div className="flex justify-between border-b border-dotted border-slate-300 pb-0.5" dir="rtl">
                            <span className="text-slate-500">مبلغ الشراء: <strong className="text-slate-900 font-semibold">{purchaseAmount || '_____________'}</strong></span>
                            <span className="text-slate-500">رقم الإيصال: <strong className="text-slate-900 font-semibold">{receiptNumber || '__________'}</strong></span>
                        </div>

                        {/* Dates & Term */}
                        <div className="flex justify-between">
                            <span className="text-slate-500">Start Date: <strong className="text-slate-900 font-semibold">{startDate || '_______'}</strong></span>
                            <span className="text-slate-500">Expiry date: <strong className="text-slate-900 font-semibold">{expiryDate || '________'}</strong></span>
                            <span className="text-slate-500">Term: <strong className="text-slate-900 font-semibold">{term || '__________'}</strong></span>
                        </div>
                        <div className="flex justify-between" dir="rtl">
                            <span className="text-slate-500">تاريخ البدء: <strong className="text-slate-900 font-semibold">{startDate || '_______'}</strong></span>
                            <span className="text-slate-500">تاريخ الانتهاء: <strong className="text-slate-900 font-semibold">{expiryDate || '________'}</strong></span>
                            <span className="text-slate-500">المدة: <strong className="text-slate-900 font-semibold">{term || '__________'}</strong></span>
                        </div>
                    </div>

                    {/* Included Treatments */}
                    <div className="mt-1 pt-1 border-t border-slate-300 grid grid-cols-2 gap-4 text-[8px] bg-white p-1 rounded">
                        <div>
                            <span className="font-bold text-slate-800 block mb-0.5">Included Treatment:</span>
                            <div className="flex flex-wrap gap-x-3 text-slate-700">
                                <span>1. {treatment1}</span>
                                <span>2. {treatment2}</span>
                                <span>3. {treatment3}</span>
                            </div>
                        </div>
                        <div dir="rtl" className="text-right">
                            <span className="font-bold text-slate-800 block mb-0.5">العلاجات المشمولة:</span>
                            <div className="flex flex-wrap gap-x-3 text-slate-700">
                                <span>١. إزالة الشعر بالليزر</span>
                                <span>٢. حقن البلازما للشعر (PRP)</span>
                                <span>٣. هيدرافاشيال كلاسيك</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    SIDE BY SIDE 8 LEGAL & CLINICAL ARTICLES
                   ══════════════════════════════════════════════════════ */}
                <div className="space-y-1.5 text-justify">
                    {/* Article I */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                I. Included procedures and unlimited sessions
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                Included Procedures in this membership are &ldquo;Unlimited sessions&rdquo; means there is no fixed numerical session limit during the stated membership term, subject to all booking, interval and medical eligibility conditions in this agreement. It does not mean treatment on demand or treatment when medically unsuitable.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                أولاً: الإجراءات المشمولة والجلسات غير المحدودة
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                تعني &ldquo;الجلسات غير المحدودة&rdquo; للإجراءات المشمولة في هذه العضوية عدم وجود حد عددي ثابت للجلسات خلال مدة العضوية المحددة، وذلك شريطة الالتزام بكافة شروط الحجز والفواصل الزمنية والأهلية الطبية الواردة في هذه الاتفاقية. ولا يعني ذلك الحصول على العلاج عند الطلب أو تلقي العلاج في حال عدم ملاءمته طبياً.
                            </p>
                        </div>
                    </div>

                    {/* Article II */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                II. Appointment days and public holidays
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                Membership procedures are available only on Mondays, Tuesdays, Wednesdays and Thursdays, during the clinic’s operating hours and by appointment. No membership procedure is available on Fridays, Saturdays, Sundays or public holidays observed at the clinic’s location. Appointments are subject to availability. A booking on an excluded day does not override these restrictions.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                ثانياً: أيام المواعيد والعطلات الرسمية
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                تتوفر إجراءات العضوية فقط في أيام الإثنين، والثلاثاء، والأربعاء، والخميس، خلال ساعات عمل العيادة وبموعد مسبق فقط. لا تتاح أي إجراءات عضوية في أيام الجمعة، والسبت، والأحد، أو خلال العطلات الرسمية المعتمدة في مقر العيادة. تخضع المواعيد لمدى التوفر، ولا يلغي أي حجز تم في يوم مستثنى هذه الشروط والقيود.
                            </p>
                        </div>
                    </div>

                    {/* Article III */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                III. Minimum interval between repeat procedures
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                There must be at least one calendar month between sessions of the same procedure. The clinic will record the earliest eligible repeat date. If the corresponding date does not exist in the following month, the earliest date is the next day after that month ends. A clinician may require a longer interval. Different procedures may be combined or scheduled close together only if the treating clinician considers this safe and appropriate.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                ثالثاً: الحد الأدنى للمدة الفاصلة بين تكرار الإجراءات
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                يجب أن تفصل مدة شهر تقويمي واحد على الأقل بين جلسات الإجراء نفسه. ستسجل العيادة أقرب تاريخ مؤهل لتكرار الجلسة. إذا كان التاريخ المقابل غير موجود في الشهر التالي، فإن أقرب تاريخ متاح يكون اليوم التالي لانتهاء ذلك الشهر. يجوز للطبيب المعالج طلب مدة فاصلة أطول. ولا يجوز الجمع بين إجراءات مختلفة أو جدولتها في أوقات متقاربة إلا إذا رأى الطبيب المعالج أن ذلك آمن ومناسب طبياً.
                            </p>
                        </div>
                    </div>

                    {/* Article IV */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                IV. Medical eligibility and treatment decisions
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                Eligibility for each procedure and session depends on assessment by an appropriately qualified clinician, applicable medical guidelines, medical history, current condition and relevant product or device instructions. The clinician may decline, postpone or stop treatment if it is unsuitable, unsafe or no longer indicated. Payment does not establish suitability. The one month minimum is a package restriction, not a guarantee that monthly treatment is appropriate.
                            </p>
                            <p className="text-slate-700 mt-0.5">
                                I will disclose my medical history, medicines and supplements, allergies, pregnancy or breastfeeding status, previous treatments and any relevant changes before each session. I will follow the preparation and aftercare instructions provided and report adverse effects promptly. I understand that results vary and no particular result is guaranteed.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                رابعاً: الأهلية الطبية وقرارات العلاج
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                تعتمد أهلية كل إجراء وجلسة على تقييم سريري يجريه طبيب مؤهل، ووفق الإرشادات الطبية المعتمدة، والتاريخ المرضي، والحالة الصحية الراهنة، وتعليمات المنتجات أو الأجهزة ذات الصلة. يحق للطبيب رفض أو تأجيل أو إيقاف العلاج إذا كان غير مناسب أو غير آمن أو لم يعد هناك داعٍ طبي له. سداد الرسوم لا يثبت الأهلية الطبية. إن الحد الأدنى البالغ شهراً واحداً هو شرط تنظيمي للعضوية، وليس ضماناً لملاءمة العلاج شهرياً.
                            </p>
                            <p className="text-slate-700 mt-0.5">
                                أقر بالتزامي بالإفصاح عن تاريخي الطبي، والأدوية والمكملات، والتحسس، وحالة الحمل أو الرضاعة، والعلاجات السابقة وأي تغييرات طارئة قبل كل جلسة. كما ألتزم بتعليمات التحضير والرعاية اللاحقة والإبلاغ الفوري عن أي أعراض جانبية. وأدرك أن النتائج تتفاوت بين الأفراد ولا يوجد ضمان لنتيجة محددة.
                            </p>
                        </div>
                    </div>

                    {/* Article V */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                V. Separate informed consent for procedures
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                Before treatment, the clinician will explain the procedure, expected benefits, material risks, alternatives including no treatment, and aftercare, and answer my questions. Required patch testing, investigations and procedure specific informed consent must be completed. I may decline treatment or withdraw consent at any time. Procedure wont be started without consent.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                خامساً: الموافقة المستنيرة المنفصلة للإجراءات الطبية
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                قبل بدء العلاج، سيقوم الطبيب بشرح الإجراء، والفوائد المتوقعة، والمخاطر الجوهرية، والبدائل المتاحة بما في ذلك عدم تلقي العلاج، وتعليمات الرعاية اللاحقة، مع الإجابة على استفساراتي. يجب استكمال اختبارات الحساسية الموضعية والفحوصات ونماذج الموافقة المستنيرة الخاصة بكل إجراء. يحق لي رفض العلاج أو سحب موافقتي في أي وقت، ولن يتم البدء بأي إجراء دون موافقة مسبقة.
                            </p>
                        </div>
                    </div>

                    {/* Article VI */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                VI. Payment and refunds
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                The membership fee is non-refundable for change of mind, voluntary cancellation, non-attendance, or unused sessions. This term does not exclude statutory cancellation or refund rights, remedies for services not supplied as agreed, or liability that cannot lawfully be excluded. Signing does not waive the patient’s legal rights.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                سادساً: الدفع واسترداد الرسوم
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                رسوم العضوية غير قابلة للاسترداد في حالات العدول عن الرأي، أو الإلغاء الاختياري، أو عدم الحضور، أو الجلسات غير المستخدمة. لا يستثني هذا البند حقوق الإلغاء أو الاسترداد القانونية المقررة نظاماً، أو التعويض عن الخدمات التي لم تُقدم وفق الاتفاق، أو أي مسؤولية لا يمكن استبعادها قانوناً. لا يعتبر التوقيع تنازلاً عن الحقوق القانونية للمريض.
                            </p>
                        </div>
                    </div>

                    {/* Article VII */}
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                VII. Expiry and reminders
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                The membership ends on the expiry date Mentioned. Sessions must take place within the membership term. The clinic will not send membership expiry notifications or reminders. I am responsible for tracking the expiry date and booking in good time, allowing for clinical intervals, appointment availability and excluded days. Unused entitlement expires, subject to applicable law and any written arrangement recorded above.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                سابعاً: انتهاء الصلاحية والتذكيرات
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                تنتهي العضوية في تاريخ الانتهاء الموضح أعلاه، ويجب الاستفادة من الجلسات خلال مدة العضوية فقط. لن ترسل العيادة إشعارات أو تذكيرات بانتهاء العضوية. تقع على عاتقي مسؤولية متابعة تاريخ الانتهاء والحجز في وقت مناسب، مع مراعاة الفواصل الزمنية السريرية وتوفر المواعيد والأيام المستثناة. تنتهي صلاحية أي مستحقات غير مستخدمة بانتهاء المدة، مع مراعاة القوانين المعمول بها وأي ترتيب كتابي مثبت أعلاه.
                            </p>
                        </div>
                    </div>

                    {/* Article VIII */}
                    <div className="grid grid-cols-2 gap-3 pb-1">
                        <div>
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                VIII. Patient acceptance and signatures
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                By signing, I confirm that I have read and understood both pages, the blanks are complete, and the terms and dates were explained before payment. My questions were answered. I specifically acknowledge the weekday and public holiday restrictions, minimum interval, medical eligibility requirements, non-refund terms and absence of expiry reminders. I freely accept these terms and have received a copy.
                            </p>
                        </div>
                        <div dir="rtl" className="text-right">
                            <strong className="font-bold text-slate-900 block text-[8px]">
                                ثامناً: إقرار وموافقة المريض والتوقيعات
                            </strong>
                            <p className="text-slate-700 mt-0.5">
                                بتوقيعي أدناه، أؤكد أنني قرأت وفهمت بنود هذا النموذج بالكامل، وأن كافة الفراغات والبيانات مستكملة، وأنه قد تم توضيح الشروط والتواريخ لي قبل السداد، وتمت الإجابة عن كافة أسئلتي. وأقر على وجه الخصوص بعلمي بقيود أيام الأسبوع والعطلات الرسمية، والحد الأدنى للفواصل الزمنية، واشتراطات الأهلية الطبية، وشروط عدم الاسترداد، وعدم إرسال تذكيرات بانتهاء الصلاحية. أقبل هذه الشروط بمحض إرادتي واستلمت نسخة منها.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    SIGNATURES BLOCK (Side by Side Bilingual)
                   ══════════════════════════════════════════════════════ */}
                <div className="mt-2 pt-2 border-t-2 border-slate-400 bg-slate-50/50 p-2 rounded">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Left Column: English Signatures */}
                        <div className="space-y-1.5 text-[8px]">
                            <div className="flex justify-between items-center">
                                <span>Patient Name: <strong className="text-slate-900">{patientName || '_______________________'}</strong></span>
                                <span>Signature: ______________________</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Date: _________________________</span>
                                <span>Time: ___________________________</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-dotted border-slate-300">
                                <span>Staff Name: <strong className="text-slate-900">{staffName || '_________________________'}</strong></span>
                                <span>Signature: ______________________</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Witness Name: _____________________</span>
                                <span>Signature: ______________________ Date: ___________</span>
                            </div>
                        </div>

                        {/* Right Column: Arabic Signatures */}
                        <div dir="rtl" className="space-y-1.5 text-[8px] text-right">
                            <div className="flex justify-between items-center">
                                <span>اسم المريضة: <strong className="text-slate-900">{patientName || '_______________________'}</strong></span>
                                <span>التوقيع: ___________________________</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>التاريخ: _________________________</span>
                                <span>الوقت: _____________________________</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-dotted border-slate-300">
                                <span>اسم الموظف/ـة: <strong className="text-slate-900">{staffName || '_________________________'}</strong></span>
                                <span>التوقيع: ___________________________</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>اسم الشاهد: ________________________</span>
                                <span>التوقيع: ___________________________ التاريخ: ___________</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Stamp / Reference */}
                <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between items-center text-[7px] text-slate-400">
                    <span>First Medical Center LLC &bull; Standard Patient Membership Agreement (Doc Ref: FMC-AGR-HER-01)</span>
                    <span dir="rtl">مركز فيرست الطبي ذ.م.م &bull; اتفاقية عضوية المريض المعتمدة &bull; صفحة ١ من ١</span>
                </div>
            </div>

            {/* Print Styles for strict 1-page output */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 5mm 8mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-size: 8px !important;
                        line-height: 1.2 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

export default function MembershipAgreementPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading agreement form...</div>}>
            <AgreementContent />
        </Suspense>
    );
}
