'use client';

import React, { useState, useEffect } from 'react';
import type { Client } from '@/lib/clients-store';
import { maskPhone, maskEmail } from '@/lib/mask-utils';
import type { EMRConfig, EMRPushRecord } from '@/lib/emr-store';
import type { ClientRestriction } from '@/lib/restrictions-store';
import { Users, Search, Merge, Check, X, AlertTriangle, Upload, FileText, Plus, CreditCard, Phone, UserPlus, ScanLine, Loader2, Link2, Unlink, ShieldAlert, MicOff, Eye, EyeOff, Send, CheckCircle2, XCircle, Clock, Download, Calendar } from 'lucide-react';

/* ── Form shape ── */
interface EditForm {
    firstName: string; middleName: string; lastName: string;
    mobile: string; whatsapp: string; email: string;
    gender: string; dateOfBirth: string; clientClass: string;
    civilStatus: string; nationality: string; passportNo: string;
    emiratesIdNumber: string; emiratesIdIssueDate: string; emiratesIdExpiryDate: string;
    idFrontBase64: string; idFrontName: string;
    idBackBase64: string; idBackName: string;
    firstNameArabic: string; lastNameArabic: string;
    religion: string; profession: string; country: string;
    citizenship: string; emirates: string; race: string;
    residentType: string; poBox: string; city: string;
    ethnicGroup: string; language: string; address: string; remark: string;
    emergencyContactPerson: string; emergencyRelationship: string;
    emergencyTelephone: string; emergencyWorkMobile: string;
}

const emptyForm: EditForm = {
    firstName: '', middleName: '', lastName: '',
    mobile: '', whatsapp: '', email: '',
    gender: '', dateOfBirth: '', clientClass: '', civilStatus: '',
    nationality: '', passportNo: '',
    emiratesIdNumber: '', emiratesIdIssueDate: '', emiratesIdExpiryDate: '',
    idFrontBase64: '', idFrontName: '', idBackBase64: '', idBackName: '',
    firstNameArabic: '', lastNameArabic: '',
    religion: '', profession: '', country: '', citizenship: '',
    emirates: '', race: '', residentType: '', poBox: '', city: '',
    ethnicGroup: '', language: '', address: '', remark: '',
    emergencyContactPerson: '', emergencyRelationship: '',
    emergencyTelephone: '', emergencyWorkMobile: '',
};

/* ── Dropdown options ── */
const NATIONALITIES = [
    'Afghan', 'Albanian', 'Algerian', 'American', 'Argentinian', 'Australian', 'Bahraini', 'Bangladeshi',
    'Belgian', 'Brazilian', 'British', 'Canadian', 'Chinese', 'Colombian', 'Cuban', 'Dutch', 'Egyptian',
    'Emirati', 'Ethiopian', 'Filipino', 'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek',
    'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Italian', 'Japanese', 'Jordanian', 'Kenyan',
    'Korean', 'Kuwaiti', 'Lebanese', 'Libyan', 'Malaysian', 'Mexican', 'Moroccan', 'Nepalese', 'New Zealander',
    'Nigerian', 'Norwegian', 'Omani', 'Pakistani', 'Palestinian', 'Peruvian', 'Polish', 'Portuguese',
    'Qatari', 'Romanian', 'Russian', 'Saudi', 'Serbian', 'Singaporean', 'Somali', 'South African',
    'Spanish', 'Sri Lankan', 'Sudanese', 'Swedish', 'Swiss', 'Syrian', 'Thai', 'Tunisian', 'Turkish',
    'Ugandan', 'Ukrainian', 'Uzbek', 'Venezuelan', 'Vietnamese', 'Yemeni', 'Other',
];
const CIVIL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const RELIGIONS = ['Islam', 'Christianity', 'Hinduism', 'Buddhism', 'Sikhism', 'Judaism', 'Other', 'Prefer not to say'];
const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const UAE_CITIES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Al Ain', 'Al Dhafra', 'Khor Fakkan', 'Kalba', 'Dibba Al Fujairah', 'Dibba Al Hisn', 'Hatta', 'Madinat Zayed', 'Ruwais', 'Jebel Ali', 'Other'];
const RESIDENT_TYPES = ['UAE Citizen', 'Resident', 'International Patient'];
const CLIENT_CLASSES = ['VIP', 'Regular', 'Insurance', 'Corporate', 'Staff'];
const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Colleague', 'Other'];
const ETHNIC_GROUPS = [
    'Arab', 'South Asian', 'Southeast Asian', 'East Asian', 'Central Asian',
    'African', 'European', 'Latin American', 'Persian', 'Turkish', 'Kurdish',
    'Baloch', 'Berber', 'Malay', 'Pacific Islander', 'Mixed', 'Other',
];
const RACES = [
    'Asian', 'Arab', 'White', 'Black', 'Hispanic', 'Mixed', 'Pacific Islander',
    'Native American', 'Other', 'Prefer not to say',
];
const LANGUAGES = [
    'Arabic', 'English', 'Hindi', 'Urdu', 'Malayalam', 'Tamil', 'Tagalog', 'Bengali',
    'Persian', 'French', 'Spanish', 'Portuguese', 'Russian', 'Chinese', 'Japanese',
    'Korean', 'German', 'Italian', 'Turkish', 'Indonesian', 'Malay', 'Swahili',
    'Pashto', 'Punjabi', 'Telugu', 'Kannada', 'Sinhala', 'Nepali', 'Thai', 'Vietnamese', 'Other',
];
const CITIZENSHIPS = [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Bahrain', 'Bangladesh',
    'Belgium', 'Brazil', 'Canada', 'China', 'Colombia', 'Cuba', 'Egypt', 'Ethiopia',
    'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'India', 'Indonesia',
    'Iran', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Korea', 'Kuwait',
    'Lebanon', 'Libya', 'Malaysia', 'Mexico', 'Morocco', 'Nepal', 'Netherlands', 'New Zealand',
    'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Somalia',
    'South Africa', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Thailand',
    'Tunisia', 'Turkey', 'UAE', 'Uganda', 'Ukraine', 'United Kingdom', 'United States',
    'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Other',
];

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [targetClientId, setTargetClientId] = useState<string>('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalClients, setTotalClients] = useState(0);
    const itemsPerPage = 50;

    // Edit / Register State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ ...emptyForm });
    const [isRegistering, setIsRegistering] = useState(false);
    const [readingEid, setReadingEid] = useState(false);
    const [eidDemoWarning, setEidDemoWarning] = useState(false);
    // Contact masking
    const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set());
    // EMR push
    const [pushingEMR, setPushingEMR] = useState<Set<string>>(new Set());
    // Client Grouping
    const [connectedPatients, setConnectedPatients] = useState<{ patientPhone: string; relationship: string }[]>([]);
    const [connSearch, setConnSearch] = useState('');
    const [connSelectedClient, setConnSelectedClient] = useState<Client | null>(null);
    const [connDropdownOpen, setConnDropdownOpen] = useState(false);
    const [newConnRelation, setNewConnRelation] = useState('Spouse');

    const refreshClients = async () => {
        try {
            const res = await fetch(`/api/admin/clients?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) {
                console.error('API error:', res.status, res.statusText);
                return; // don't try to parse and set invalid data
            }
            const data = await res.json();
            if (data.clients && Array.isArray(data.clients)) {
                setClients(data.clients);
                setTotalClients(data.total || 0);
            } else if (Array.isArray(data)) {
                setClients(data); // Legacy fallback
                setTotalClients(data.length);
            } else {
                console.error('Unexpected API response shape:', data);
            }
        } catch (e) {
            console.error('Failed to load clients:', e);
        }
    };

    // Debounced search and page change
    useEffect(() => {
        const timer = setTimeout(() => {
            refreshClients();
        }, 350);
        return () => clearTimeout(timer);
    }, [currentPage, searchQuery]);

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // SimplyBook import state
    const [importingSB, setImportingSB] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number; total: number; bookingsFetched: number } | null>(null);

    // Visit dates modal
    const [visitDatesClient, setVisitDatesClient] = useState<Client | null>(null);

    const handleImportFromSB = async () => {
        if (!confirm('This will import all SimplyBook clients with their full booking history. Existing clients will have their visit data refreshed. Continue?')) return;
        setImportingSB(true);
        setImportResult(null);
        try {
            const res = await fetch('/api/admin/simplybook/import-clients', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                setImportResult({ imported: data.imported, updated: data.updated ?? 0, skipped: data.skipped, total: data.total, bookingsFetched: data.bookingsFetched ?? 0 });
                refreshClients();
            } else {
                alert('Import failed: ' + (data.error || 'Unknown error'));
            }
        } catch {
            alert('Import failed. Please check the console for details.');
        } finally {
            setImportingSB(false);
        }
    };

    const toggleContactReveal = (clientId: string) => {
        setRevealedContacts(prev => {
            const next = new Set(prev);
            next.has(clientId) ? next.delete(clientId) : next.add(clientId);
            return next;
        });
    };

    // EMR + Restrictions state (loaded from API)
    const [emrConfig, setEmrConfig] = useState<EMRConfig>({ endpointUrl: '', apiKey: '', enabled: false, maskContacts: true });
    const [emrPushRecords, setEmrPushRecords] = useState<Record<string, EMRPushRecord>>({});
    const [clientRestrictions, setClientRestrictions] = useState<Record<string, ClientRestriction>>({});

    // Fetch EMR config on mount
    useEffect(() => {
        fetch('/api/admin/emr').then(r => r.json()).then(data => setEmrConfig(data.config || data)).catch(() => {});
    }, []);

    const handlePushToEMR = async (client: Client, isAuto = false) => {
        if (!emrConfig.enabled || !emrConfig.endpointUrl) {
            if (!isAuto) alert('EMR integration is not configured. Please go to Settings to configure it.');
            return;
        }

        // Omit contact details for privacy when exporting to Clinic Soft EMR
        const emrPayload = { ...client };
        delete emrPayload.email;
        delete emrPayload.phone;
        delete emrPayload.mobile;
        delete emrPayload.whatsapp;
        delete emrPayload.emergencyContactPerson;
        delete emrPayload.emergencyTelephone;
        delete emrPayload.emergencyWorkMobile;
        delete emrPayload.emergencyRelationship;

        setPushingEMR(prev => new Set(prev).add(client.id));
        setEmrPushRecords(prev => ({ ...prev, [client.id]: { clientId: client.id, status: 'pending', timestamp: new Date().toISOString() } }));
        try {
            const res = await fetch('/api/admin/emr/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpointUrl: emrConfig.endpointUrl,
                    apiKey: emrConfig.apiKey,
                    patientData: emrPayload,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setEmrPushRecords(prev => ({ ...prev, [client.id]: { clientId: client.id, status: 'success', timestamp: new Date().toISOString(), emrReferenceId: data.emrReferenceId } }));
            } else {
                setEmrPushRecords(prev => ({ ...prev, [client.id]: { clientId: client.id, status: 'failed', timestamp: new Date().toISOString(), errorMessage: data.error } }));
            }
        } catch (err: unknown) {
            setEmrPushRecords(prev => ({ ...prev, [client.id]: { clientId: client.id, status: 'failed', timestamp: new Date().toISOString(), errorMessage: err instanceof Error ? err.message : 'Network error' } }));
        } finally {
            setPushingEMR(prev => { const next = new Set(prev); next.delete(client.id); return next; });
        }
    };

    const getEmrStatusBadge = (clientId: string) => {
        const record = emrPushRecords[clientId];
        if (!record) return null;
        const icons = { pending: <Clock className="w-3 h-3" />, success: <CheckCircle2 className="w-3 h-3" />, failed: <XCircle className="w-3 h-3" /> };
        const colors = { pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        const labels = { pending: 'Syncing', success: 'Synced', failed: 'Failed' };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[record.status]}`} title={record.emrReferenceId || record.errorMessage || ''}>
                {icons[record.status]} {labels[record.status]}
            </span>
        );
    };

    const totalPages = Math.max(1, Math.ceil(totalClients / itemsPerPage));
    const paginatedClients = clients;

    const toggleSelection = (id: string) => {
        const s = new Set(selectedClientIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedClientIds(s);
    };

    const handleMergeClick = () => { if (selectedClientIds.size < 2) return; setTargetClientId(Array.from(selectedClientIds)[0]); setIsMergeModalOpen(true); };

    const confirmMerge = async () => {
        const ids = Array.from(selectedClientIds);
        try {
            await fetch('/api/admin/clients/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetClientId, sourceClientIds: ids })
            });
            alert('Clients merged successfully.');
        } catch (error) {
            alert('Failed to merge clients.');
        }
        setSelectedClientIds(new Set()); setIsMergeModalOpen(false); refreshClients();
    };

    const handleEditClick = (client: Client, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingClient(client); setIsRegistering(false);
        const np = client.name.split(' ');
        setEditForm({
            firstName: client.firstName || np[0] || '',
            middleName: client.middleName || '',
            lastName: client.lastName || np.slice(1).join(' ') || '',
            mobile: client.mobile || client.phone || '',
            whatsapp: client.whatsapp || '',
            email: client.email || '',
            gender: client.gender || '',
            dateOfBirth: client.dateOfBirth || '',
            clientClass: client.clientClass || '',
            civilStatus: client.civilStatus || '',
            nationality: client.nationality || '',
            passportNo: client.passportNo || '',
            emiratesIdNumber: client.emiratesIdNumber || '',
            emiratesIdIssueDate: client.emiratesIdIssueDate || '',
            emiratesIdExpiryDate: client.emiratesIdExpiryDate || '',
            idFrontBase64: client.idFrontBase64 || '',
            idFrontName: client.idFrontName || '',
            idBackBase64: client.idBackBase64 || '',
            idBackName: client.idBackName || '',
            firstNameArabic: client.firstNameArabic || '',
            lastNameArabic: client.lastNameArabic || '',
            religion: client.religion || '',
            profession: client.profession || '',
            country: client.country || '',
            citizenship: client.citizenship || '',
            emirates: client.emirates || '',
            race: client.race || '',
            residentType: client.residentType || '',
            poBox: client.poBox || '',
            city: client.city || '',
            ethnicGroup: client.ethnicGroup || '',
            language: client.language || '',
            address: client.address || '',
            remark: client.remark || '',
            emergencyContactPerson: client.emergencyContactPerson || '',
            emergencyRelationship: client.emergencyRelationship || '',
            emergencyTelephone: client.emergencyTelephone || '',
            emergencyWorkMobile: client.emergencyWorkMobile || '',
        });
        setIsEditModalOpen(true);
        // Load connected patients from localStorage
        const stored = localStorage.getItem(`client-grouping-${client.id}`);
        setConnectedPatients(stored ? JSON.parse(stored) : (client.connectedPatients || []));
    };

    const openRegister = () => { setEditingClient(null); setIsRegistering(true); setEditForm({ ...emptyForm }); setConnectedPatients([]); setIsEditModalOpen(true); };

    const handleReadEmiratesId = async () => {
        setReadingEid(true);
        setEidDemoWarning(false);
        try {
            const res = await fetch('/api/admin/emirates-id/read');
            const data = await res.json();
            if (data.success && data.formFields) {
                const ff = data.formFields as Record<string, string>;
                setEditingClient(null);
                setIsRegistering(true);
                setEditForm(prev => ({
                    ...emptyForm,
                    firstName: ff.firstName || prev.firstName,
                    middleName: ff.middleName || prev.middleName,
                    lastName: ff.lastName || prev.lastName,
                    firstNameArabic: ff.firstNameArabic || prev.firstNameArabic,
                    lastNameArabic: ff.lastNameArabic || prev.lastNameArabic,
                    emiratesIdNumber: ff.emiratesIdNumber || prev.emiratesIdNumber,
                    emiratesIdIssueDate: ff.emiratesIdIssueDate || prev.emiratesIdIssueDate,
                    emiratesIdExpiryDate: ff.emiratesIdExpiryDate || prev.emiratesIdExpiryDate,
                    dateOfBirth: ff.dateOfBirth || prev.dateOfBirth,
                    gender: ff.gender || prev.gender,
                    nationality: ff.nationality || prev.nationality,
                    profession: ff.profession || prev.profession,
                }));
                if (data.isDemo) setEidDemoWarning(true);
                setIsEditModalOpen(true);
            } else {
                alert(data.error || 'Failed to read Emirates ID card.');
            }
        } catch {
            alert('Could not connect to Emirates ID reader service.');
        } finally {
            setReadingEid(false);
        }
    };

    const handleFileUpload = (field: 'idFrontBase64' | 'idBackBase64', nameField: 'idFrontName' | 'idBackName', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { alert('File size must be under 1 MB'); e.target.value = ''; return; }
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { alert('Only image or PDF files are allowed'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => setEditForm(prev => ({ ...prev, [field]: reader.result as string, [nameField]: file.name }));
        reader.readAsDataURL(file);
    };

    const saveEdit = () => {
        const fullName = [editForm.firstName, editForm.middleName, editForm.lastName].filter(Boolean).join(' ');
        if (!fullName) { alert('Please enter at least a first and last name'); return; }

        const updates: Partial<Client> = {
            name: fullName,
            firstName: editForm.firstName || undefined,
            middleName: editForm.middleName || undefined,
            lastName: editForm.lastName || undefined,
            mobile: editForm.mobile || undefined,
            whatsapp: editForm.whatsapp || undefined,
            email: editForm.email || undefined,
            gender: (editForm.gender as 'Male' | 'Female') || undefined,
            dateOfBirth: editForm.dateOfBirth || undefined,
            clientClass: editForm.clientClass || undefined,
            civilStatus: editForm.civilStatus || undefined,
            nationality: editForm.nationality || undefined,
            passportNo: editForm.passportNo || undefined,
            emiratesIdNumber: editForm.emiratesIdNumber || undefined,
            emiratesIdIssueDate: editForm.emiratesIdIssueDate || undefined,
            emiratesIdExpiryDate: editForm.emiratesIdExpiryDate || undefined,
            idFrontBase64: editForm.idFrontBase64 || undefined,
            idFrontName: editForm.idFrontName || undefined,
            idBackBase64: editForm.idBackBase64 || undefined,
            idBackName: editForm.idBackName || undefined,
            firstNameArabic: editForm.firstNameArabic || undefined,
            lastNameArabic: editForm.lastNameArabic || undefined,
            religion: editForm.religion || undefined,
            profession: editForm.profession || undefined,
            country: editForm.country || undefined,
            citizenship: editForm.citizenship || undefined,
            emirates: editForm.emirates || undefined,
            race: editForm.race || undefined,
            residentType: editForm.residentType || undefined,
            poBox: editForm.poBox || undefined,
            city: editForm.city || undefined,
            ethnicGroup: editForm.ethnicGroup || undefined,
            language: editForm.language || undefined,
            address: editForm.address || undefined,
            remark: editForm.remark || undefined,
            emergencyContactPerson: editForm.emergencyContactPerson || undefined,
            emergencyRelationship: editForm.emergencyRelationship || undefined,
            emergencyTelephone: editForm.emergencyTelephone || undefined,
            emergencyWorkMobile: editForm.emergencyWorkMobile || undefined,
        };

        const payload = editingClient 
            ? { id: editingClient.id, ...updates }
            : { id: `client_${Date.now()}`, ...updates };

        fetch('/api/admin/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => {
            refreshClients();
            // Automatically push to EMR on new registration
            if (!editingClient && emrConfig.enabled && emrConfig.endpointUrl) {
                handlePushToEMR(payload as Client, true);
            }
        }).catch(() => {});
        
        // Save connected patients to localStorage
        localStorage.setItem(`client-grouping-${payload.id}`, JSON.stringify(connectedPatients));
        
        setIsEditModalOpen(false);
    };

    /* ── Helper: text input ── */
    const fld = (label: string, key: keyof EditForm, opts?: { type?: string; placeholder?: string; dir?: string; required?: boolean; colSpan?: number }) => (
        <div className={opts?.colSpan === 2 ? 'col-span-2' : ''}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}{opts?.required && ' *'}</label>
            <input
                type={opts?.type || 'text'}
                dir={opts?.dir}
                required={opts?.required}
                placeholder={opts?.placeholder || ''}
                className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                value={editForm[key]}
                onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
            />
        </div>
    );

    /* ── Helper: select input ── */
    const sel = (label: string, key: keyof EditForm, options: string[], placeholder?: string) => (
        <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
            <select className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                <option value="">{placeholder || `Select ${label}`}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );

    /* ── Helper: file upload ── */
    const fileUp = (label: string, base64Key: 'idFrontBase64' | 'idBackBase64', nameKey: 'idFrontName' | 'idBackName') => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{label}</label>
            {editForm[base64Key] ? (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                    <FileText className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium flex-1 truncate">{editForm[nameKey]}</span>
                    <button type="button" onClick={() => setEditForm({ ...editForm, [base64Key]: '', [nameKey]: '' })}
                        className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
            ) : (
                <input type="file" accept="image/*,.pdf"
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                    onChange={e => handleFileUpload(base64Key, nameKey, e)} />
            )}
        </div>
    );

    /* ── Section header ── */
    const secHeader = (icon: React.ReactNode, title: string) => (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-1">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">{icon} {title}</h3>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-600" /> Client Management
                </h1>
                <div className="flex gap-3">
                    {selectedClientIds.size >= 2 && (
                        <button onClick={handleMergeClick} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                            <Merge className="w-4 h-4" /> Merge Selected ({selectedClientIds.size})
                        </button>
                    )}
                    <button
                        onClick={handleImportFromSB}
                        disabled={importingSB}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-60"
                    >
                        {importingSB ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {importingSB ? 'Importing...' : 'Import from SimplyBook'}
                    </button>
                    <button onClick={handleReadEmiratesId} disabled={readingEid} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60">
                        {readingEid ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                        {readingEid ? 'Reading...' : 'Read Emirates ID'}
                    </button>
                    <button onClick={openRegister} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> Register Client
                    </button>
                </div>
            </div>

            {/* Import result banner */}
            {importResult && (
                <div className="mb-4 p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-violet-800 dark:text-violet-200 mb-1">
                                ✓ SimplyBook import complete
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-violet-700 dark:text-violet-300">
                                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                                    {importResult.imported} new clients
                                </span>
                                {importResult.updated > 0 && (
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                                        {importResult.updated} refreshed
                                    </span>
                                )}
                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                                    {importResult.skipped} skipped
                                </span>
                                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                                    {importResult.bookingsFetched} visits synced
                                </span>
                                <span className="text-violet-500">out of {importResult.total} total SB clients</span>
                            </div>
                        </div>
                        <button onClick={() => setImportResult(null)} className="text-violet-400 hover:text-violet-600 shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search by name, phone, email, Emirates ID, or passport..."
                        className="w-full pl-10 p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
            </div>

            {/* Clients Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm">
                        <tr>
                            <th className="p-4 w-12"><input type="checkbox" disabled /></th>
                            <th className="p-4">Client Name</th>
                            <th className="p-4">Emirates ID</th>
                            <th className="p-4">Contact</th>
                            <th className="p-4">Nationality</th>
                            <th className="p-4">Bookings</th>
                            <th className="p-4">Last Visit</th>
                            <th className="p-4">Class</th>
                            <th className="p-4">EMR</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {paginatedClients.map(client => (
                            <tr key={client.id}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedClientIds.has(client.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                onClick={() => toggleSelection(client.id)}>
                                <td className="p-4">
                                    <input type="checkbox" checked={selectedClientIds.has(client.id)}
                                        onChange={() => toggleSelection(client.id)} className="w-4 h-4 text-indigo-600 rounded"
                                        onClick={e => e.stopPropagation()} />
                                </td>
                                <td className="p-4">
                                    <div className="font-medium text-gray-900 dark:text-white">{client.name}</div>
                                    {client.gender && <div className="text-xs text-gray-400">{client.gender}{client.civilStatus ? ` • ${client.civilStatus}` : ''}</div>}
                                    {client.source === 'simplybook' && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full mt-0.5">
                                            SimplyBook
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-300 font-mono">{client.emiratesIdNumber || '—'}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5">
                                        <div>
                                            <div className="text-sm text-gray-600 dark:text-gray-300">{revealedContacts.has(client.id) ? (client.mobile || client.phone || '—') : maskPhone(client.mobile || client.phone)}</div>
                                            <div className="text-xs text-gray-400">{revealedContacts.has(client.id) ? (client.email || '') : (client.email ? maskEmail(client.email) : '')}</div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); toggleContactReveal(client.id); }} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors" title={revealedContacts.has(client.id) ? 'Hide' : 'Reveal'}>
                                            {revealedContacts.has(client.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{client.nationality || '—'}</td>
                                <td className="p-4">
                                    {client.visitDates && client.visitDates.length > 0 ? (
                                        <button
                                            onClick={e => { e.stopPropagation(); setVisitDatesClient(client); }}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                                            title="Click to view visit dates"
                                        >
                                            <Calendar className="w-3 h-3" />
                                            {client.totalBookings > 0 ? client.totalBookings : client.visitDates.length}
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                            {client.totalBookings}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-gray-500">{client.lastBookingDate || '-'}</td>
                                <td className="p-4">
                                    {client.clientClass ? (
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${client.clientClass === 'VIP' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>{client.clientClass}</span>
                                    ) : <span className="text-xs text-gray-400">—</span>}
                                </td>
                                <td className="p-4">
                                    {getEmrStatusBadge(client.id)}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1">
                                        <button onClick={e => handleEditClick(client, e)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                                        <button onClick={e => { e.stopPropagation(); handlePushToEMR(client); }} disabled={pushingEMR.has(client.id)}
                                            className="flex items-center gap-1 text-teal-600 hover:text-teal-800 text-sm font-medium disabled:opacity-50 ml-2" title="Push to EMR">
                                            {pushingEMR.has(client.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            EMR
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginatedClients.length === 0 && (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-500">No clients found matching your search.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalClients)}</span> of{' '}
                        <span className="font-medium">{totalClients}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                            Previous
                        </button>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            Page {currentPage} of {totalPages}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* ── Visit Dates Modal ── */}
            {visitDatesClient && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setVisitDatesClient(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-indigo-200 font-medium mb-1">SimplyBook Visit History</p>
                                    <h2 className="text-lg font-bold">{visitDatesClient.name}</h2>
                                    <p className="text-indigo-100 text-sm mt-0.5">
                                        {visitDatesClient.mobile || visitDatesClient.phone || visitDatesClient.email || '—'}
                                    </p>
                                </div>
                                <button onClick={() => setVisitDatesClient(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                                    {visitDatesClient.visitDates?.length ?? visitDatesClient.totalBookings} total visits
                                </span>
                                {visitDatesClient.lastBookingDate && (
                                    <span className="text-xs text-indigo-200">Last: {visitDatesClient.lastBookingDate}</span>
                                )}
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-5 max-h-96 overflow-y-auto">
                            {visitDatesClient.visitDates && visitDatesClient.visitDates.length > 0 ? (
                                <div className="space-y-2">
                                    {visitDatesClient.visitDates.map((date, i) => {
                                        const d = new Date(date + 'T00:00:00');
                                        const isToday = date === new Date().toISOString().split('T')[0];
                                        const isPast = d < new Date();
                                        return (
                                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                                                isToday ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' :
                                                isPast  ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700' :
                                                          'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                                            }`}>
                                                <div className={`w-2 h-2 rounded-full ${
                                                    isToday ? 'bg-amber-500' : isPast ? 'bg-gray-400' : 'bg-emerald-500'
                                                }`} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {d.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    isToday ? 'bg-amber-100 text-amber-700' :
                                                    isPast  ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
                                                              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                }`}>
                                                    {isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No visit dates recorded</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-center">
                            <p className="text-xs text-gray-400">Data sourced from SimplyBook.me · Re-import to refresh</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Merge Modal ── */}
            {isMergeModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white"><Merge className="w-5 h-5 text-indigo-600" /> Merge Duplicate Clients</h2>
                            <button onClick={() => setIsMergeModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-4 rounded-lg mb-6 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div><h3 className="font-bold text-sm">Action cannot be undone</h3>
                                    <p className="text-sm mt-1">Merging will combine all bookings into the <strong>Primary Profile</strong>. The other profiles will be removed.</p></div>
                            </div>
                            <p className="mb-4 font-medium text-gray-700 dark:text-gray-300">Select the Primary Profile to keep:</p>
                            <div className="space-y-3">
                                {Array.from(selectedClientIds).map(id => {
                                    const client = clients.find(c => c.id === id);
                                    if (!client) return null;
                                    const isTarget = targetClientId === id;
                                    return (
                                        <div key={id} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isTarget ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`}
                                            onClick={() => setTargetClientId(id)}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-1 ${isTarget ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-400'}`}>
                                                    {isTarget && <Check className="w-3 h-3" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{client.name}</div>
                                                    <div className="text-sm text-gray-500">{client.email || 'No Email'} • {client.mobile || client.phone || 'No Phone'}</div>
                                                    <div className="text-xs text-indigo-600 mt-1">{client.totalBookings} bookings • Last seen: {client.lastBookingDate}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                            <button onClick={() => setIsMergeModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                            <button onClick={confirmMerge} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none">Confirm Merge</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit / Register Modal ── */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isRegistering ? 'Register New Client' : 'Edit Client Details'}
                            </h2>
                            {eidDemoWarning && (
                                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span><strong>Demo mode:</strong> ICA Toolkit not detected. Form filled with sample data for testing. Install the ICA Toolkit for real card reading.</span>
                                    <button onClick={() => setEidDemoWarning(false)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
                            {/* ── Section 1: Personal Information ── */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Personal Information
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {fld('First Name', 'firstName', { required: true, placeholder: 'e.g. Ahmed' })}
                                    {fld('Middle Name', 'middleName', { placeholder: 'e.g. Mohammed' })}
                                    {fld('Last Name', 'lastName', { required: true, placeholder: 'e.g. Al Rashid' })}
                                    {fld('Mobile Number', 'mobile', { type: 'tel', placeholder: '+971 5X XXX XXXX' })}
                                    {fld('WhatsApp Number', 'whatsapp', { type: 'tel', placeholder: '+971 5X XXX XXXX' })}
                                    {fld('Email ID', 'email', { type: 'email', placeholder: 'email@example.com' })}
                                    {sel('Gender', 'gender', ['Male', 'Female'])}
                                    {fld('Date of Birth', 'dateOfBirth', { type: 'date' })}
                                    {sel('Class', 'clientClass', CLIENT_CLASSES)}
                                    {sel('Civil Status', 'civilStatus', CIVIL_STATUSES)}
                                    {sel('Nationality', 'nationality', NATIONALITIES)}
                                    {fld('Passport No', 'passportNo', { placeholder: 'e.g. AB1234567' })}
                                </div>
                            </div>

                            {/* ── Section 2: Emirates ID ── */}
                            {secHeader(<CreditCard className="w-4 h-4" />, 'Emirates ID')}
                            <div className="grid grid-cols-3 gap-4">
                                {fld('Emirates ID Number', 'emiratesIdNumber', { placeholder: '784-XXXX-XXXXXXX-X' })}
                                {fld('Issue Date', 'emiratesIdIssueDate', { type: 'date' })}
                                {fld('Expiry Date', 'emiratesIdExpiryDate', { type: 'date' })}
                            </div>

                            {/* ── Section 3: Upload ID Copy ── */}
                            {secHeader(<Upload className="w-4 h-4" />, 'Upload Emirates ID Copy (max 1 MB each)')}
                            <div className="grid grid-cols-2 gap-4">
                                {fileUp('Upload Front Page', 'idFrontBase64', 'idFrontName')}
                                {fileUp('Upload Back Page', 'idBackBase64', 'idBackName')}
                            </div>

                            {/* ── Section 4: Downloads from UAE ID Card ── */}
                            {secHeader(<FileText className="w-4 h-4" />, 'Downloads From UAE ID Card')}
                            <div className="grid grid-cols-3 gap-4">
                                {fld('First Name in Arabic', 'firstNameArabic', { dir: 'rtl', placeholder: 'الاسم الأول' })}
                                {fld('Last Name in Arabic', 'lastNameArabic', { dir: 'rtl', placeholder: 'الاسم الأخير' })}
                                {sel('Religion', 'religion', RELIGIONS)}
                                {fld('Profession', 'profession', { placeholder: 'e.g. Engineer' })}
                                {fld('Country', 'country', { placeholder: 'e.g. UAE' })}
                                {sel('Citizenship', 'citizenship', CITIZENSHIPS)}
                                {sel('Emirates', 'emirates', EMIRATES)}
                                {sel('Race', 'race', RACES)}
                                {sel('Resident Type', 'residentType', RESIDENT_TYPES)}
                                {fld('PO Box', 'poBox', { placeholder: 'e.g. 12345' })}
                                {sel('City', 'city', UAE_CITIES)}
                                {sel('Ethnic Group', 'ethnicGroup', ETHNIC_GROUPS)}
                                {sel('Language', 'language', LANGUAGES)}
                                {fld('Address', 'address', { placeholder: 'Full address', colSpan: 2 })}
                                {fld('Remark', 'remark', { placeholder: 'Any additional notes', colSpan: 2 })}
                            </div>

                            {/* ── Section 5: Emergency Contact ── */}
                            {secHeader(<Phone className="w-4 h-4" />, 'Emergency Contact')}
                            <div className="grid grid-cols-2 gap-4">
                                {fld('Contact Person', 'emergencyContactPerson', { placeholder: 'Full name' })}
                                {sel('Relationship', 'emergencyRelationship', RELATIONSHIPS)}
                                {fld('Telephone', 'emergencyTelephone', { type: 'tel', placeholder: '+971 XX XXX XXXX' })}
                                {fld('Work / Mobile', 'emergencyWorkMobile', { type: 'tel', placeholder: '+971 5X XXX XXXX' })}
                            </div>

                            {/* ── Section 5b: Booking Restrictions ── */}
                            {!isRegistering && editingClient && (() => {
                                const clientId = editingClient.id;
                                const restriction = clientRestrictions[clientId] || { noShowDates: [], noShowExempt: false, voiceAgentBlocked: false };
                                const recentNoShows = restriction.noShowDates.filter((d: string) => {
                                    const diff = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
                                    return diff <= 7;
                                });
                                return (
                                    <>
                                        {secHeader(<ShieldAlert className="w-4 h-4" />, 'Booking Restrictions')}
                                        <div className="space-y-4">
                                            {/* No-show count badge */}
                                            {restriction.noShowDates.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-500">No-Show History:</span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                                        {restriction.noShowDates.length} total • {recentNoShows.length} in last 7 days
                                                    </span>
                                                </div>
                                            )}

                                            {/* Toggles */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                                    <input type="checkbox" checked={restriction.noShowExempt}
                                                        onChange={e => {
                                                            fetch('/api/admin/restrictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setNoShowExempt', clientId, exempt: e.target.checked }) });
                                                            setClientRestrictions(prev => ({ ...prev, [clientId]: { ...restriction, noShowExempt: e.target.checked } }));
                                                        }}
                                                        className="w-4 h-4 text-green-600 rounded" />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Exempt from No-Show Restrictions</div>
                                                        <div className="text-xs text-gray-400">Allow booking during peak hours despite no-shows</div>
                                                    </div>
                                                </label>

                                                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                                    <input type="checkbox" checked={restriction.voiceAgentBlocked}
                                                        onChange={e => {
                                                            fetch('/api/admin/restrictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setVoiceAgentBlocked', clientId, blocked: e.target.checked }) });
                                                            setClientRestrictions(prev => ({ ...prev, [clientId]: { ...restriction, voiceAgentBlocked: e.target.checked } }));
                                                        }}
                                                        className="w-4 h-4 text-red-600 rounded" />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                            <MicOff className="w-3.5 h-3.5" /> Block Voice Agent Booking
                                                        </div>
                                                        <div className="text-xs text-gray-400">Prevent booking via voice assistant</div>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* ── Section 6: Client Grouping ── */}
                            {secHeader(<Link2 className="w-4 h-4" />, 'Client Grouping / Connected Patients')}
                            <div>
                                {/* Existing connections */}
                                {connectedPatients.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {connectedPatients.map((cp, idx) => {
                                            const linked = clients.find(c => (c.mobile || c.phone) === cp.patientPhone);
                                            return (
                                                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-gray-900 dark:text-white text-sm">{linked?.name || 'Unknown Patient'}</span>
                                                                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{cp.relationship}</span>
                                                                {!linked && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Not in system</span>}
                                                            </div>
                                                            {linked ? (
                                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                    <span>📱 {linked.mobile || linked.phone || '—'}</span>
                                                                    <span>✉️ {linked.email || '—'}</span>
                                                                    <span>🌍 {linked.nationality || '—'}</span>
                                                                    {linked.emiratesIdNumber && <span>🪪 {linked.emiratesIdNumber}</span>}
                                                                    {linked.clientClass && <span>⭐ {linked.clientClass}</span>}
                                                                    <span>📋 {linked.totalBookings} booking{linked.totalBookings !== 1 ? 's' : ''}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-400">Phone: {cp.patientPhone}</div>
                                                            )}
                                                        </div>
                                                        <button type="button" onClick={() => setConnectedPatients(connectedPatients.filter((_, i) => i !== idx))}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 ml-2" title="Remove">
                                                            <Unlink className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add new connection */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 relative">
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search Patient (Name or Phone)</label>
                                        <input type="text" placeholder="Type name or phone to search..."
                                            className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                            value={connSelectedClient ? connSelectedClient.name : connSearch}
                                            onChange={e => { setConnSearch(e.target.value); setConnSelectedClient(null); setConnDropdownOpen(true); }}
                                            onFocus={() => { if (connSearch.length >= 1) setConnDropdownOpen(true); }} />
                                        {/* Search results dropdown */}
                                        {connDropdownOpen && connSearch.length >= 1 && !connSelectedClient && (() => {
                                            const matches = clients.filter(c =>
                                                (c.name.toLowerCase().includes(connSearch.toLowerCase()) ||
                                                    (c.mobile || c.phone || '').includes(connSearch) ||
                                                    (c.email || '').toLowerCase().includes(connSearch.toLowerCase())) &&
                                                !connectedPatients.some(cp => cp.patientPhone === (c.mobile || c.phone)) &&
                                                c.id !== editingClient?.id
                                            ).slice(0, 8);
                                            return matches.length > 0 ? (
                                                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                                    {matches.map(c => (
                                                        <button key={c.id} type="button"
                                                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                                                            onClick={() => { setConnSelectedClient(c); setConnSearch(''); setConnDropdownOpen(false); }}>
                                                            <div className="font-medium text-sm text-gray-900 dark:text-white">{c.name}</div>
                                                            <div className="text-xs text-gray-500 flex gap-3">
                                                                <span>📱 {c.mobile || c.phone || '—'}</span>
                                                                <span>✉️ {c.email || '—'}</span>
                                                                {c.nationality && <span>🌍 {c.nationality}</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-xs text-gray-500">
                                                    No matching clients found.
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Relationship</label>
                                        <select className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600"
                                            value={newConnRelation} onChange={e => setNewConnRelation(e.target.value)}>
                                            {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <button type="button" onClick={() => {
                                        if (!connSelectedClient) return;
                                        const phone = connSelectedClient.mobile || connSelectedClient.phone || '';
                                        if (connectedPatients.some(p => p.patientPhone === phone)) { alert('Already connected.'); return; }
                                        setConnectedPatients([...connectedPatients, { patientPhone: phone, relationship: newConnRelation }]);
                                        setConnSelectedClient(null); setConnSearch('');
                                    }} disabled={!connSelectedClient} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1">
                                        <UserPlus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>

                                {/* Selected client preview */}
                                {connSelectedClient && (
                                    <div className="mt-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="font-semibold text-green-800 dark:text-green-300">✓ Selected: {connSelectedClient.name}</span>
                                            <button type="button" onClick={() => { setConnSelectedClient(null); setConnSearch(''); }} className="text-green-600 hover:text-green-800 text-xs underline">Clear</button>
                                        </div>
                                        <div className="text-green-700 dark:text-green-400 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5">
                                            <span>📱 {connSelectedClient.mobile || connSelectedClient.phone || '—'}</span>
                                            <span>✉️ {connSelectedClient.email || '—'}</span>
                                            <span>🌍 {connSelectedClient.nationality || '—'}</span>
                                            {connSelectedClient.emiratesIdNumber && <span>🪪 {connSelectedClient.emiratesIdNumber}</span>}
                                            {connSelectedClient.clientClass && <span>⭐ {connSelectedClient.clientClass}</span>}
                                            <span>📋 {connSelectedClient.totalBookings} booking{connSelectedClient.totalBookings !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 mt-2">Link family members or related patients to this client for group tracking.</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                            <button onClick={saveEdit} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">{isRegistering ? 'Register Client' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
