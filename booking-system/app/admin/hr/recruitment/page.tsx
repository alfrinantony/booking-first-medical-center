'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Briefcase, UserPlus, Search, Filter, Plus, X, Edit2, Trash2,
    ChevronRight, Star, Calendar, DollarSign, MapPin, Users,
    ArrowRight, Eye, Clock, CheckCircle, AlertTriangle, XCircle,
    Upload, Image as ImageIcon
} from 'lucide-react';
import type {
    JobOpening, Candidate, RecruitmentStage, OpeningStatus, CandidateSource
} from '@/lib/hr-recruitment-store';
import {
    RECRUITMENT_STAGES, ACTIVE_STAGES, CANDIDATE_SOURCES, JOB_DESCRIPTION_TEMPLATES
} from '@/lib/hr-recruitment-store';
import { WORKPLACES } from '@/lib/hr-store';

type ViewMode = 'openings' | 'pipeline';

interface OpeningWithCount extends JobOpening {
    _candidateCount?: number;
}

// ── Empty forms ──
const emptyOpening = {
    title: '', department: '', workplaceId: 'clinic-1', workplaceName: 'Al Muraqabat Branch',
    employmentType: 'FULL_TIME' as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT', description: '', requirements: '',
    salaryMin: 0, salaryMax: 0, status: 'OPEN' as OpeningStatus, openDate: new Date().toISOString().split('T')[0],
};

const emptyCandidate = {
    jobOpeningId: '', firstName: '', lastName: '', email: '', phone: '',
    nationality: '', currentPosition: '', experience: 0,
    stage: 'Application Received' as RecruitmentStage, source: 'Job Portal' as CandidateSource,
    interviewDate: '', interviewNotes: '', interviewRating: 0,
    offerSalary: 0, offerDate: '', expectedJoiningDate: '', notes: '', rejectionReason: '',
};

export default function RecruitmentPage() {
    const [view, setView] = useState<ViewMode>('openings');
    const [openings, setOpenings] = useState<OpeningWithCount[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedOpeningId, setSelectedOpeningId] = useState('');

    // Modals
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [showCandidateDetail, setShowCandidateDetail] = useState<Candidate | null>(null);
    const [editingOpening, setEditingOpening] = useState<OpeningWithCount | null>(null);
    const [openingForm, setOpeningForm] = useState({ ...emptyOpening });
    const [candidateForm, setCandidateForm] = useState({ ...emptyCandidate });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>('');

    // ── Data loading ──
    const loadOpenings = useCallback(async () => {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (search && view === 'openings') params.set('search', search);
        const res = await fetch(`/api/admin/hr/recruitment/openings?${params}`);
        if (res.ok) setOpenings(await res.json());
    }, [statusFilter, search, view]);

    const loadCandidates = useCallback(async () => {
        const params = new URLSearchParams();
        if (selectedOpeningId) params.set('openingId', selectedOpeningId);
        if (search && view === 'pipeline') params.set('search', search);
        const res = await fetch(`/api/admin/hr/recruitment/candidates?${params}`);
        if (res.ok) setCandidates(await res.json());
    }, [selectedOpeningId, search, view]);

    useEffect(() => {
        Promise.all([loadOpenings(), loadCandidates()]).then(() => setLoading(false));
    }, [loadOpenings, loadCandidates]);

    // ── Opening CRUD ──
    const handleSaveOpening = async (e: React.FormEvent) => {
        e.preventDefault();
        const wp = WORKPLACES.find((w: { id: string; name: string }) => w.id === openingForm.workplaceId);
        const payload = { ...openingForm, workplaceName: wp?.name || openingForm.workplaceName };

        if (editingOpening) {
            await fetch(`/api/admin/hr/recruitment/openings/${editingOpening.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
        } else {
            await fetch('/api/admin/hr/recruitment/openings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
        }
        setShowOpeningModal(false);
        setEditingOpening(null);
        setOpeningForm({ ...emptyOpening });
        loadOpenings();
    };

    const handleDeleteOpening = async (id: string) => {
        if (!confirm('Delete this job opening and all its candidates?')) return;
        await fetch(`/api/admin/hr/recruitment/openings/${id}`, { method: 'DELETE' });
        loadOpenings();
        loadCandidates();
    };

    // ── Photo file handler ──
    const handlePhotoChange = (file: File | null) => {
        setPhotoFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setPhotoPreview('');
        }
    };

    // ── Candidate CRUD ──
    const handleSaveCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...candidateForm } as any;
        // Add file names (in a real system, these would be uploaded to Azure Blob)
        if (photoFile) {
            payload.photoFileName = photoFile.name;
            payload.photoUrl = photoPreview; // base64 for demo
        }
        if (cvFile) {
            payload.cvFileName = cvFile.name;
            payload.cvUrl = `#cv-${cvFile.name}`; // placeholder
        }

        if (showCandidateDetail) {
            await fetch(`/api/admin/hr/recruitment/candidates/${showCandidateDetail.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            setShowCandidateDetail(null);
        } else {
            await fetch('/api/admin/hr/recruitment/candidates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            setShowCandidateModal(false);
        }
        setCandidateForm({ ...emptyCandidate });
        setPhotoFile(null);
        setCvFile(null);
        setPhotoPreview('');
        loadCandidates();
    };

    const handleDeleteCandidate = async (id: string) => {
        if (!confirm('Delete this candidate?')) return;
        await fetch(`/api/admin/hr/recruitment/candidates/${id}`, { method: 'DELETE' });
        setShowCandidateDetail(null);
        loadCandidates();
    };

    const handleStageChange = async (candidateId: string, newStage: RecruitmentStage) => {
        await fetch(`/api/admin/hr/recruitment/candidates/${candidateId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: newStage }),
        });
        loadCandidates();
    };

    // ── Helpers ──
    const getStatusBadge = (status: OpeningStatus) => {
        const map: Record<string, string> = {
            OPEN: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            ON_HOLD: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            CLOSED: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
            FILLED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        };
        return map[status] || '';
    };

    const getStageBadgeColor = (stage: RecruitmentStage) => {
        const map: Record<string, string> = {
            'Application Received': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            'Screening': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'Interview Scheduled': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            'Interview Done': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            'Offer Sent': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'Offer Accepted': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            'Onboarding': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
            'Hired': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            'Withdrawn': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        };
        return map[stage] || '';
    };

    const getStageIcon = (stage: RecruitmentStage) => {
        if (stage === 'Hired') return <CheckCircle className="w-3.5 h-3.5" />;
        if (stage === 'Rejected') return <XCircle className="w-3.5 h-3.5" />;
        if (stage === 'Withdrawn') return <AlertTriangle className="w-3.5 h-3.5" />;
        if (stage.includes('Interview')) return <Calendar className="w-3.5 h-3.5" />;
        if (stage.includes('Offer')) return <DollarSign className="w-3.5 h-3.5" />;
        return <Clock className="w-3.5 h-3.5" />;
    };

    const getOpeningTitle = (id: string) => openings.find(o => o.id === id)?.title || 'Unknown';

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-indigo-600" />
                        Recruitment
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage job openings and candidate pipeline</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setOpeningForm({ ...emptyOpening }); setEditingOpening(null); setShowOpeningModal(true); }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors text-sm">
                        <Plus className="w-4 h-4" /> New Opening
                    </button>
                    <button onClick={() => {
                        setCandidateForm({ ...emptyCandidate, jobOpeningId: selectedOpeningId || openings[0]?.id || '' });
                        setShowCandidateModal(true);
                    }}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors text-sm">
                        <UserPlus className="w-4 h-4" /> Add Candidate
                    </button>
                </div>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Open Positions', value: openings.filter(o => o.status === 'OPEN').length, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Total Candidates', value: candidates.length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'In Interview', value: candidates.filter(c => c.stage === 'Interview Scheduled' || c.stage === 'Interview Done').length, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'Offers Pending', value: candidates.filter(c => c.stage === 'Offer Sent').length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100 dark:border-gray-700`}>
                        <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* View Toggle */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button onClick={() => setView('openings')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'openings' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Briefcase className="w-4 h-4 inline mr-2" />Job Openings
                </button>
                <button onClick={() => setView('pipeline')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'pipeline' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Users className="w-4 h-4 inline mr-2" />Candidate Pipeline
                </button>
            </div>

            {/* ═══ JOB OPENINGS VIEW ═══ */}
            {view === 'openings' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search openings..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="CLOSED">Closed</option>
                            <option value="FILLED">Filled</option>
                        </select>
                    </div>

                    {openings.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
                            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No job openings found.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 uppercase">
                                        <th className="px-6 py-3">Position</th>
                                        <th className="px-6 py-3">Department</th>
                                        <th className="px-6 py-3">Branch</th>
                                        <th className="px-6 py-3">Salary Range</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Candidates</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {openings.map(op => (
                                        <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{op.title}</div>
                                                <div className="text-xs text-gray-500">{op.employmentType.replace('_', ' ')}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">{op.department}</td>
                                            <td className="px-6 py-4 text-sm flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />{op.workplaceName}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {op.salaryMin && op.salaryMax ?
                                                    `AED ${op.salaryMin.toLocaleString()} – ${op.salaryMax.toLocaleString()}` :
                                                    <span className="text-gray-400">–</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(op.status)}`}>
                                                    {op.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button onClick={() => { setSelectedOpeningId(op.id); setView('pipeline'); }}
                                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                                                    {(op as any)._candidateCount || 0} <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button onClick={() => {
                                                        setEditingOpening(op);
                                                        setOpeningForm({
                                                            title: op.title, department: op.department,
                                                            workplaceId: op.workplaceId, workplaceName: op.workplaceName,
                                                            employmentType: op.employmentType, description: op.description,
                                                            requirements: op.requirements, salaryMin: op.salaryMin || 0,
                                                            salaryMax: op.salaryMax || 0, status: op.status, openDate: op.openDate,
                                                        });
                                                        setShowOpeningModal(true);
                                                    }} className="text-indigo-600 hover:text-indigo-800 p-1" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteOpening(op.id)}
                                                        className="text-red-600 hover:text-red-800 p-1" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ═══ CANDIDATE PIPELINE VIEW ═══ */}
            {view === 'pipeline' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search candidates..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm"
                            value={selectedOpeningId} onChange={e => setSelectedOpeningId(e.target.value)}>
                            <option value="">All Openings</option>
                            {openings.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                        </select>
                    </div>

                    {/* Pipeline Board */}
                    <div className="overflow-x-auto pb-4">
                        <div className="flex gap-4 min-w-max">
                            {ACTIVE_STAGES.map(stage => {
                                const stageCandidates = candidates.filter(c => c.stage === stage);
                                return (
                                    <div key={stage} className="w-72 flex-shrink-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                {getStageIcon(stage)}
                                                {stage}
                                            </h3>
                                            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                                {stageCandidates.length}
                                            </span>
                                        </div>
                                        <div className="space-y-3 min-h-[120px] bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-dashed border-gray-200 dark:border-gray-700">
                                            {stageCandidates.length === 0 ? (
                                                <p className="text-xs text-gray-400 text-center py-8">No candidates</p>
                                            ) : (
                                                stageCandidates.map(cand => (
                                                    <div key={cand.id}
                                                        className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                                                        onClick={() => {
                                                            setShowCandidateDetail(cand);
                                                            setCandidateForm({
                                                                jobOpeningId: cand.jobOpeningId,
                                                                firstName: cand.firstName, lastName: cand.lastName,
                                                                email: cand.email, phone: cand.phone,
                                                                nationality: cand.nationality,
                                                                currentPosition: cand.currentPosition || '',
                                                                experience: cand.experience, stage: cand.stage,
                                                                source: cand.source, interviewDate: cand.interviewDate || '',
                                                                interviewNotes: cand.interviewNotes || '',
                                                                interviewRating: cand.interviewRating || 0,
                                                                offerSalary: cand.offerSalary || 0,
                                                                offerDate: cand.offerDate || '',
                                                                expectedJoiningDate: cand.expectedJoiningDate || '',
                                                                notes: cand.notes || '',
                                                                rejectionReason: cand.rejectionReason || '',
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                                    {cand.firstName} {cand.lastName}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{getOpeningTitle(cand.jobOpeningId)}</p>
                                                            </div>
                                                            {cand.interviewRating && cand.interviewRating > 0 && (
                                                                <div className="flex items-center gap-0.5">
                                                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                                    <span className="text-xs font-medium text-amber-600">{cand.interviewRating}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                                                {cand.source}
                                                            </span>
                                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                                                {cand.experience}y exp
                                                            </span>
                                                        </div>
                                                        {/* Stage move buttons */}
                                                        <div className="mt-2 flex gap-1">
                                                            <select
                                                                className="text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600 flex-1"
                                                                value={cand.stage}
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e => { e.stopPropagation(); handleStageChange(cand.id, e.target.value as RecruitmentStage); }}
                                                            >
                                                                {RECRUITMENT_STAGES.map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Terminal stages */}
                            {(['Hired', 'Rejected', 'Withdrawn'] as RecruitmentStage[]).map(stage => {
                                const stageCandidates = candidates.filter(c => c.stage === stage);
                                if (stageCandidates.length === 0) return null;
                                return (
                                    <div key={stage} className="w-72 flex-shrink-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                {getStageIcon(stage)}
                                                {stage}
                                            </h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStageBadgeColor(stage)}`}>
                                                {stageCandidates.length}
                                            </span>
                                        </div>
                                        <div className="space-y-3 min-h-[120px] bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-dashed border-gray-200 dark:border-gray-700">
                                            {stageCandidates.map(cand => (
                                                <div key={cand.id}
                                                    className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer"
                                                    onClick={() => {
                                                        setShowCandidateDetail(cand);
                                                        setCandidateForm({
                                                            jobOpeningId: cand.jobOpeningId,
                                                            firstName: cand.firstName, lastName: cand.lastName,
                                                            email: cand.email, phone: cand.phone,
                                                            nationality: cand.nationality,
                                                            currentPosition: cand.currentPosition || '',
                                                            experience: cand.experience, stage: cand.stage,
                                                            source: cand.source, interviewDate: cand.interviewDate || '',
                                                            interviewNotes: cand.interviewNotes || '',
                                                            interviewRating: cand.interviewRating || 0,
                                                            offerSalary: cand.offerSalary || 0,
                                                            offerDate: cand.offerDate || '',
                                                            expectedJoiningDate: cand.expectedJoiningDate || '',
                                                            notes: cand.notes || '',
                                                            rejectionReason: cand.rejectionReason || '',
                                                        });
                                                    }}
                                                >
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {cand.firstName} {cand.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{getOpeningTitle(cand.jobOpeningId)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ═══ OPENING MODAL ═══ */}
            {showOpeningModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl p-6 shadow-xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingOpening ? 'Edit Job Opening' : 'New Job Opening'}
                            </h2>
                            <button onClick={() => { setShowOpeningModal(false); setEditingOpening(null); }} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveOpening} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Job Title *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.title} onChange={e => setOpeningForm({ ...openingForm, title: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Department *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.department} onChange={e => setOpeningForm({ ...openingForm, department: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Branch</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.workplaceId} onChange={e => setOpeningForm({ ...openingForm, workplaceId: e.target.value })}>
                                        {WORKPLACES.map((w: { id: string; name: string }) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Employment Type</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.employmentType} onChange={e => setOpeningForm({ ...openingForm, employmentType: e.target.value as any })}>
                                        <option value="FULL_TIME">Full Time</option>
                                        <option value="PART_TIME">Part Time</option>
                                        <option value="CONTRACT">Contract</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.status} onChange={e => setOpeningForm({ ...openingForm, status: e.target.value as OpeningStatus })}>
                                        <option value="OPEN">Open</option>
                                        <option value="ON_HOLD">On Hold</option>
                                        <option value="CLOSED">Closed</option>
                                        <option value="FILLED">Filled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Salary Min (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.salaryMin} onChange={e => setOpeningForm({ ...openingForm, salaryMin: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Salary Max (AED)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.salaryMax} onChange={e => setOpeningForm({ ...openingForm, salaryMax: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Open Date</label>
                                    <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={openingForm.openDate} onChange={e => setOpeningForm({ ...openingForm, openDate: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Load Template</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value="" onChange={e => {
                                            const tmpl = JOB_DESCRIPTION_TEMPLATES[e.target.value];
                                            if (tmpl) {
                                                setOpeningForm({ ...openingForm, title: e.target.value, description: tmpl.description, requirements: tmpl.requirements });
                                            }
                                        }}>
                                        <option value="">Select a role template...</option>
                                        {Object.keys(JOB_DESCRIPTION_TEMPLATES).map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <textarea rows={4} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={openingForm.description} onChange={e => setOpeningForm({ ...openingForm, description: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Requirements</label>
                                    <textarea rows={4} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={openingForm.requirements} onChange={e => setOpeningForm({ ...openingForm, requirements: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => { setShowOpeningModal(false); setEditingOpening(null); }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                    {editingOpening ? 'Update' : 'Create'} Opening
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ ADD CANDIDATE MODAL ═══ */}
            {showCandidateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl p-6 shadow-xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Candidate</h2>
                            <button onClick={() => setShowCandidateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCandidate} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Job Opening *</label>
                                    <select required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.jobOpeningId} onChange={e => setCandidateForm({ ...candidateForm, jobOpeningId: e.target.value })}>
                                        <option value="">Select opening...</option>
                                        {openings.filter(o => o.status === 'OPEN').map(o => (
                                            <option key={o.id} value={o.id}>{o.title} — {o.workplaceName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">First Name *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.firstName} onChange={e => setCandidateForm({ ...candidateForm, firstName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Last Name *</label>
                                    <input required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.lastName} onChange={e => setCandidateForm({ ...candidateForm, lastName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input type="email" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.email} onChange={e => setCandidateForm({ ...candidateForm, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Phone</label>
                                    <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.phone} onChange={e => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nationality</label>
                                    <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.nationality} onChange={e => setCandidateForm({ ...candidateForm, nationality: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Current Position</label>
                                    <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.currentPosition} onChange={e => setCandidateForm({ ...candidateForm, currentPosition: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Experience (years)</label>
                                    <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.experience} onChange={e => setCandidateForm({ ...candidateForm, experience: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Source</label>
                                    <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.source} onChange={e => setCandidateForm({ ...candidateForm, source: e.target.value as CandidateSource })}>
                                        {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={candidateForm.notes} onChange={e => setCandidateForm({ ...candidateForm, notes: e.target.value })} />
                                </div>
                                {/* Photo & CV Upload */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Applicant Photo</label>
                                    <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <ImageIcon className="w-5 h-5 text-gray-400" />
                                        )}
                                        <span className="text-xs text-gray-500">{photoFile?.name || 'Choose photo...'}</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoChange(e.target.files?.[0] || null)} />
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">CV / Resume</label>
                                    <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                                        <Upload className="w-5 h-5 text-gray-400" />
                                        <span className="text-xs text-gray-500">{cvFile?.name || 'Choose CV file...'}</span>
                                        <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setCvFile(e.target.files?.[0] || null)} />
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowCandidateModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Add Candidate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ CANDIDATE DETAIL / EDIT MODAL ═══ */}
            {showCandidateDetail && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl p-6 shadow-xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {showCandidateDetail.firstName} {showCandidateDetail.lastName}
                                <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageBadgeColor(showCandidateDetail.stage)}`}>
                                    {showCandidateDetail.stage}
                                </span>
                            </h2>
                            <button onClick={() => setShowCandidateDetail(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCandidate} className="space-y-5">
                            {/* Personal */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Candidate Info</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.firstName} onChange={e => setCandidateForm({ ...candidateForm, firstName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.lastName} onChange={e => setCandidateForm({ ...candidateForm, lastName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                        <input type="email" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.email} onChange={e => setCandidateForm({ ...candidateForm, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.phone} onChange={e => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Nationality</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.nationality} onChange={e => setCandidateForm({ ...candidateForm, nationality: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Experience (years)</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.experience} onChange={e => setCandidateForm({ ...candidateForm, experience: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Current Position</label>
                                        <input className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.currentPosition} onChange={e => setCandidateForm({ ...candidateForm, currentPosition: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.source} onChange={e => setCandidateForm({ ...candidateForm, source: e.target.value as CandidateSource })}>
                                            {CANDIDATE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Pipeline Stage</label>
                                        <select className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.stage} onChange={e => setCandidateForm({ ...candidateForm, stage: e.target.value as RecruitmentStage })}>
                                            {RECRUITMENT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </fieldset>

                            {/* Interview */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Interview</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Interview Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.interviewDate} onChange={e => setCandidateForm({ ...candidateForm, interviewDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Rating (1-5)</label>
                                        <div className="flex gap-1 items-center mt-1">
                                            {[1, 2, 3, 4, 5].map(r => (
                                                <button key={r} type="button" onClick={() => setCandidateForm({ ...candidateForm, interviewRating: r })}
                                                    className="focus:outline-none">
                                                    <Star className={`w-5 h-5 ${r <= (candidateForm.interviewRating || 0) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="col-span-3 sm:col-span-1" />
                                    <div className="col-span-3">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Interview Notes</label>
                                        <textarea rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.interviewNotes} onChange={e => setCandidateForm({ ...candidateForm, interviewNotes: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Offer */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Offer Details</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Offered Salary (AED)</label>
                                        <input type="number" min="0" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.offerSalary} onChange={e => setCandidateForm({ ...candidateForm, offerSalary: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Offer Date</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.offerDate} onChange={e => setCandidateForm({ ...candidateForm, offerDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Expected Joining</label>
                                        <input type="date" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={candidateForm.expectedJoiningDate} onChange={e => setCandidateForm({ ...candidateForm, expectedJoiningDate: e.target.value })} />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Photo & CV */}
                            <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">Attachments</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Applicant Photo</label>
                                        <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                                            {(photoPreview || showCandidateDetail?.photoUrl) ? (
                                                <img src={photoPreview || showCandidateDetail?.photoUrl} alt="Photo" className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                    <ImageIcon className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-xs text-gray-600">{photoFile?.name || showCandidateDetail?.photoFileName || 'No photo uploaded'}</span>
                                                <p className="text-[10px] text-indigo-500">Click to change</p>
                                            </div>
                                            <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoChange(e.target.files?.[0] || null)} />
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CV / Resume</label>
                                        <label className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                <Upload className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-600">{cvFile?.name || showCandidateDetail?.cvFileName || 'No CV uploaded'}</span>
                                                <p className="text-[10px] text-emerald-500">Click to change</p>
                                            </div>
                                            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setCvFile(e.target.files?.[0] || null)} />
                                        </label>
                                    </div>
                                </div>
                            </fieldset>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">General Notes</label>
                                <textarea rows={2} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
                                    value={candidateForm.notes} onChange={e => setCandidateForm({ ...candidateForm, notes: e.target.value })} />
                            </div>

                            {candidateForm.stage === 'Rejected' && (
                                <div>
                                    <label className="block text-xs font-medium text-red-500 mb-1">Rejection Reason</label>
                                    <textarea rows={2} className="w-full p-2 border border-red-200 rounded-md dark:bg-gray-700 dark:border-red-800 text-sm"
                                        value={candidateForm.rejectionReason} onChange={e => setCandidateForm({ ...candidateForm, rejectionReason: e.target.value })} />
                                </div>
                            )}

                            <div className="flex justify-between pt-2">
                                <button type="button" onClick={() => handleDeleteCandidate(showCandidateDetail.id)}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setShowCandidateDetail(null)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
