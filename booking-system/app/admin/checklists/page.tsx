'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Calendar, CheckCircle, Clock, Camera, FileText, ChevronDown, Check, X, ShieldAlert, Plus, Loader2 } from 'lucide-react';
import { clinics } from '@/lib/data';
import { ChecklistItem, DailyChecklist } from '@/lib/checklist-store';

const DEFAULT_ITEMS: (ChecklistItem & { isRequiredPhoto: boolean })[] = [
    { id: 'cleanliness', title: 'Clinic Cleanliness Verified', checked: false, isRequiredPhoto: true, photoUrl: '', notes: '' },
    { id: 'crash-cart', title: 'Emergency Crash Cart Checked', checked: false, isRequiredPhoto: false, photoUrl: '', notes: '' },
    { id: 'supplies', title: 'No Expired Supplies Confirmed', checked: false, isRequiredPhoto: false, photoUrl: '', notes: '' }
];

export default function DailyChecklists() {
    const { user } = useAuthStore();
    const [checklists, setChecklists] = useState<DailyChecklist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [showForm, setShowForm] = useState(false);
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formBranchId, setFormBranchId] = useState(clinics[0]?.id || '');
    const [formItems, setFormItems] = useState(DEFAULT_ITEMS.map(item => ({ ...item })));

    useEffect(() => {
        fetchChecklists();
    }, []);

    const fetchChecklists = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/admin/checklists');
            if (res.ok) {
                const data = await res.json();
                setChecklists(data);
            }
        } catch (error) {
            console.error('Failed to fetch checklists', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhotoUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/checklists/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const newItems = [...formItems];
                newItems[index].photoUrl = data.url;
                setFormItems(newItems);
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (err) {
            alert('Upload failed due to network error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        const allChecked = formItems.every(i => i.checked);
        if (!allChecked) {
            if (!confirm('Some items are not marked as completed. Are you sure you want to submit?')) {
                return;
            }
        }

        const missingRequiredPhotos = formItems.some(i => i.isRequiredPhoto && !i.photoUrl);
        if (missingRequiredPhotos) {
            alert('Please upload photos for all required items (like Cleanliness).');
            return;
        }

        setIsSubmitting(true);
        const branchName = clinics.find(c => c.id === formBranchId)?.name || 'Unknown Branch';

        try {
            const res = await fetch('/api/admin/checklists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: formDate,
                    branchId: formBranchId,
                    branchName,
                    supervisorName: user?.name || 'Unknown Supervisor',
                    items: formItems.map(i => ({
                        id: i.id,
                        title: i.title,
                        checked: i.checked,
                        photoUrl: i.photoUrl,
                        notes: i.notes
                    }))
                })
            });

            if (res.ok) {
                setShowForm(false);
                setFormItems(DEFAULT_ITEMS.map(item => ({ ...item })));
                fetchChecklists();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to submit checklist');
            }
        } catch (error) {
            alert('Network error submitting checklist');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-indigo-600" />
                        Daily Supervisor Checklist
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Submit and monitor daily clinic inspections</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition shadow-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    New Checklist
                </button>
            </div>

            {/* Checklist Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Submit Daily Checklist</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Supervisor: {user?.name}</p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-1.5 rounded-lg border">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="checklistForm" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full border-gray-200 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Branch</label>
                                        <select
                                            value={formBranchId}
                                            onChange={(e) => setFormBranchId(e.target.value)}
                                            className="w-full border-gray-200 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900"
                                            required
                                        >
                                            {clinics.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-900 dark:text-white border-b pb-2">Inspection Items</h3>
                                    {formItems.map((item, index) => (
                                        <div key={item.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <div className="flex items-start gap-4">
                                                <div className="pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newItems = [...formItems];
                                                            newItems[index].checked = !newItems[index].checked;
                                                            setFormItems(newItems);
                                                        }}
                                                        className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${
                                                            item.checked 
                                                                ? 'bg-green-500 border-green-500 text-white' 
                                                                : 'bg-white border-gray-300 text-transparent dark:bg-gray-800 dark:border-gray-600'
                                                        }`}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white text-lg">{item.title}</p>
                                                        {item.isRequiredPhoto && <p className="text-xs text-orange-500 font-semibold">Photo Request Required</p>}
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                        <div className="flex-1">
                                                            <input 
                                                                type="text" 
                                                                placeholder="Add notes / remarks..." 
                                                                value={item.notes || ''}
                                                                onChange={(e) => {
                                                                    const newItems = [...formItems];
                                                                    newItems[index].notes = e.target.value;
                                                                    setFormItems(newItems);
                                                                }}
                                                                className="w-full text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800"
                                                            />
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-2">
                                                            {item.photoUrl ? (
                                                                <a 
                                                                    href={item.photoUrl} 
                                                                    target="_blank" 
                                                                    className="h-9 px-3 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-indigo-100"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" /> Photo Added
                                                                </a>
                                                            ) : (
                                                                <label className="h-9 px-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2 text-sm font-medium cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                                                                    <Camera className="w-4 h-4" />
                                                                    Capture
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*" 
                                                                        capture="environment" // Encourages mobile camera use
                                                                        className="hidden" 
                                                                        onChange={(e) => handlePhotoUpload(index, e)} 
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="checklistForm"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Checklist History */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        Submission History
                    </h2>
                </div>
                
                {isLoading ? (
                    <div className="p-12 text-center text-gray-500">Loading history...</div>
                ) : checklists.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Submissions Found</h3>
                        <p>No daily checklists have been recorded yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold">Branch</th>
                                    <th className="px-6 py-4 font-semibold">Supervisor</th>
                                    <th className="px-6 py-4 font-semibold text-center">Completion</th>
                                    <th className="px-6 py-4 font-semibold">Photos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {checklists.map((chk) => {
                                    const completedItems = chk.items.filter(i => i.checked).length;
                                    const totalItems = chk.items.length;
                                    const photosCount = chk.items.filter(i => i.photoUrl).length;
                                    
                                    return (
                                        <tr key={chk.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{new Date(chk.date).toLocaleDateString('en-GB')}</div>
                                                <div className="text-xs text-gray-400 mt-1">{new Date(chk.submittedAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium text-xs">
                                                    {chk.branchName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                                {chk.supervisorName}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className={`h-full ${completedItems === totalItems ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${(completedItems / totalItems) * 100}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500">{completedItems}/{totalItems}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                                                    <Camera className="w-4 h-4 text-gray-400" />
                                                    {photosCount} Attached
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
