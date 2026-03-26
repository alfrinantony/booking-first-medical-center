'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { CheckCircle, Camera, FileText, X, AlertTriangle, Plus, Loader2, Pill, Wrench, ShieldAlert } from 'lucide-react';
import { clinics } from '@/lib/data';
import type { RoomChecklist, RoomChecklistStatus } from '@/lib/checklist-store';
import type { EquipmentItem } from '@/lib/equipment-store';
import type { Medicine } from '@/lib/data';

// Helper for generic consumables
const STANDARD_CONSUMABLES = ['Bed Sheets', 'Gloves', 'Syringes', 'Alcohol Swabs', 'Gauze'];

export default function DailyOperationsDashboard() {
    const { user } = useAuthStore();
    
    // Global State
    const [checklists, setChecklists] = useState<RoomChecklist[]>([]);
    const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
    const [medicineList, setMedicineList] = useState<Medicine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBranchId, setSelectedBranchId] = useState(clinics[0]?.id || '');
    
    // Modal State
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State (initialized when modal opens)
    const [pictures, setPictures] = useState<string[]>([]);
    const [missingItemsText, setMissingItemsText] = useState('');
    const [remarks, setRemarks] = useState('');
    const [equipmentChecks, setEquipmentChecks] = useState<{equipmentId: string; status: any}[]>([]);
    const [consumableChecks, setConsumableChecks] = useState<{itemName: string; status: any}[]>([]);
    const [medicineChecks, setMedicineChecks] = useState<{medicineId: string; requiredQty: number; refilledQty: number; shortage: number; missing: boolean}[]>([]);

    useEffect(() => {
        fetchDependencies();
    }, []);

    useEffect(() => {
        fetchChecklists();
    }, [selectedDate, selectedBranchId]);

    const fetchDependencies = async () => {
        try {
            // In a real scenario we'd query /api/admin/equipment & /api/admin/medicines
            // Due to limitations in the environment, we might fetch from local storage if API isn't built, 
            // but we'll try API routes (assuming standard standard setup).
            const [eqRes, medRes] = await Promise.all([
                fetch('/api/admin/equipment').catch(() => null),
                fetch('/api/admin/medicines').catch(() => null)
            ]);

            if (eqRes?.ok) {
                const eq = await eqRes.json();
                setEquipmentList(eq);
            }
            if (medRes?.ok) {
                const meds = await medRes.json();
                setMedicineList(meds);
            }
        } catch (error) {
            console.error('Failed to load dependencies', error);
        }
    };

    const fetchChecklists = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/admin/checklists?date=${selectedDate}&branchId=${selectedBranchId}`);
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

    const activeBranch = clinics.find(c => c.id === selectedBranchId);
    const activeRoom = activeBranch?.rooms?.find(r => r.id === activeRoomId);

    const openRoomModal = (roomId: string) => {
        const room = activeBranch?.rooms?.find(r => r.id === roomId);
        if (!room) return;
        
        // Find existing checklist for today
        const existing = checklists.find(c => c.roomId === roomId);
        
        setActiveRoomId(roomId);
        
        if (existing) {
            setPictures(existing.pictures || []);
            setMissingItemsText(existing.missingItems?.join(', ') || '');
            setRemarks(existing.remarks || '');
            setEquipmentChecks(existing.equipmentChecks || []);
            setConsumableChecks(existing.consumableChecks || []);
            setMedicineChecks(existing.medicineChecks || []);
        } else {
            setPictures([]);
            setMissingItemsText('');
            setRemarks('');
            
            // Auto populate assigned equipment
            setEquipmentChecks(room.assignedEquipmentIds.map(id => ({ equipmentId: id, status: 'Available' })));
            
            // Auto populate standard consumables
            setConsumableChecks(STANDARD_CONSUMABLES.map(c => ({ itemName: c, status: 'Adequate' })));
            
            // Auto populate required medicines
            setMedicineChecks(room.requiredMedicineIds.map(rm => ({
                medicineId: rm.id,
                requiredQty: rm.requiredQty,
                refilledQty: 0,
                shortage: rm.requiredQty,
                missing: false
            })));
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                setPictures(prev => [...prev, data.url]);
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (err) {
            alert('Upload failed due to network error');
        }
    };

    const handleMedicineRefillChange = (index: number, val: string) => {
        const updated = [...medicineChecks];
        const qty = parseInt(val) || 0;
        updated[index].refilledQty = qty;
        updated[index].shortage = Math.max(0, updated[index].requiredQty - qty);
        updated[index].missing = updated[index].shortage > 0;
        setMedicineChecks(updated);
    };

    const deriveStatus = (): RoomChecklistStatus => {
        if (activeRoom?.type === 'Procedure' && medicineChecks.some(m => m.shortage > 0)) {
            return 'Medicine Low';
        }
        if (equipmentChecks.some(e => e.status === 'Issue' || e.status === 'Missing')) {
            return 'Equipment Issue';
        }
        if (consumableChecks.some(c => c.status === 'Missing' || c.status === 'Low')) {
            return 'Consumables Low';
        }
        if (missingItemsText.trim().length > 0) {
            return 'Missing Items';
        }
        if (pictures.length === 0) {
            return 'Pending'; // Strict photo rule
        }
        return 'Complete';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeRoom) return;

        // Validation Rules
        if (pictures.length === 0) {
            alert('At least one photo is required to submit a room inspection.');
            return;
        }
        if (activeRoom.type === 'Procedure' && medicineChecks.some(m => m.shortage > 0)) {
            if (!confirm('WARNING: Procedure room medicines are short! This will flag a critical operations issue. Submit anyway?')) {
                return;
            }
        }

        setIsSubmitting(true);
        const missingArray = missingItemsText.split(',').map(s => s.trim()).filter(Boolean);
        const finalStatus = deriveStatus();

        try {
            const res = await fetch('/api/admin/checklists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    branchId: selectedBranchId,
                    roomId: activeRoom.id,
                    supervisorName: user?.name || 'Admin',
                    status: finalStatus,
                    pictures,
                    missingItems: missingArray,
                    remarks,
                    equipmentChecks,
                    consumableChecks,
                    medicineChecks
                })
            });

            if (res.ok) {
                setActiveRoomId(null);
                fetchChecklists();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to submit timeline');
            }
        } catch (error) {
            alert('Encountered an error saving the room checklist');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status: RoomChecklistStatus) => {
        switch (status) {
            case 'Complete': return 'bg-green-100 text-green-700 border-green-200';
            case 'Pending': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'Equipment Issue': return 'bg-red-100 text-red-700 border-red-200';
            case 'Medicine Low': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-orange-100 text-orange-700 border-orange-200';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-indigo-600" />
                        Daily Operations Dashboard
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Granular room-by-room readiness and inventory sync</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border-gray-200 dark:border-gray-700 rounded-xl focus:ring-indigo-500 bg-white dark:bg-gray-800"
                    />
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="border-gray-200 dark:border-gray-700 rounded-xl focus:ring-indigo-500 bg-white dark:bg-gray-800"
                    >
                        {clinics.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading facilities...
                    </div>
                ) : !activeBranch?.rooms || activeBranch.rooms.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Rooms Configured</h3>
                        <p className="text-gray-500">This branch has no physical rooms mapped in the system.</p>
                    </div>
                ) : (
                    activeBranch.rooms.map(room => {
                        const existingChecklist = checklists.find(c => c.roomId === room.id);
                        const status = existingChecklist?.status || 'Pending';
                        
                        return (
                            <button
                                key={room.id}
                                onClick={() => openRoomModal(room.id)}
                                className="text-left bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-300 hover:shadow-md transition group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-indigo-600 transition truncate">{room.name}</h3>
                                        <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{room.type}</span>
                                    </div>
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusColor(status)}`}>
                                        {status}
                                    </span>
                                </div>

                                {existingChecklist && (
                                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                            <Camera className="w-4 h-4 text-gray-400" />
                                            {existingChecklist.pictures?.length || 0} Photos
                                        </div>
                                        {existingChecklist.missingItems?.length > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs text-orange-600 font-medium">
                                                <AlertTriangle className="w-4 h-4" />
                                                {existingChecklist.missingItems.length} Missing
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Checklist Form Modal */}
            {activeRoomId && activeRoom && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-sm">
                    <div className="bg-gray-50 dark:bg-gray-900 md:rounded-3xl shadow-2xl w-full max-w-4xl h-full md:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{activeRoom.name}</h2>
                                <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
                                    {activeBranch?.name} &bull; <span className="uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{activeRoom.type}</span>
                                </p>
                            </div>
                            <button onClick={() => setActiveRoomId(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-full transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Form Body */}
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="roomChecklistForm" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-12">
                                
                                {/* Section: Photos */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                                        <Camera className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Live Snapshots <span className="text-red-500">*</span></h3>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tracking-tight">
                                        {pictures.map((pic, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                                                <img src={pic} alt="Room" className="object-cover w-full h-full hover:scale-105 transition duration-500" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setPictures(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur transition"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-500 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition group bg-white dark:bg-gray-800">
                                            <div className="p-3 bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 rounded-full mb-2 transition">
                                                <Plus className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-medium">Add Photo</span>
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                                        </label>
                                    </div>
                                </div>

                                {/* Section: Equipment */}
                                {equipmentChecks.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                                            <Wrench className="w-5 h-5 text-indigo-600" />
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Equipment Validation</h3>
                                        </div>
                                        <div className="grid gap-3">
                                            {equipmentChecks.map((eq, idx) => {
                                                const eqDetails = equipmentList.find(e => e.id === eq.equipmentId);
                                                return (
                                                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="font-semibold text-gray-900 dark:text-white">
                                                            {eqDetails?.name || `Equipment (${eq.equipmentId})`}
                                                        </div>
                                                        <select
                                                            value={eq.status}
                                                            onChange={(e) => {
                                                                const clone = [...equipmentChecks];
                                                                clone[idx].status = e.target.value as any;
                                                                setEquipmentChecks(clone);
                                                            }}
                                                            className={`text-sm rounded-lg font-medium border-gray-200 ${
                                                                eq.status === 'Available' ? 'bg-green-50 text-green-700' : 
                                                                eq.status === 'Issue' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                                                            }`}
                                                        >
                                                            <option value="Available">Available & Firing</option>
                                                            <option value="Maintenance">Under Maintenance</option>
                                                            <option value="Issue">Broken / Issue</option>
                                                            <option value="Missing">Missing from Room</option>
                                                        </select>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Section: Consumables */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                                        <FileText className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">General Consumables</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {consumableChecks.map((c, idx) => (
                                            <div key={idx} className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                                <span className="font-medium text-sm text-gray-700 dark:text-gray-200">{c.itemName}</span>
                                                <select
                                                    value={c.status}
                                                    onChange={(e) => {
                                                        const clone = [...consumableChecks];
                                                        clone[idx].status = e.target.value as any;
                                                        setConsumableChecks(clone);
                                                    }}
                                                    className="text-xs p-1.5 rounded bg-gray-50 border-gray-200 font-semibold text-gray-600 cursor-pointer"
                                                >
                                                    <option value="Adequate">Adequate</option>
                                                    <option value="Refilled">Refilled</option>
                                                    <option value="Low">Low Stock</option>
                                                    <option value="Missing">Missing</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section: Medicines */}
                                {medicineChecks.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                            <div className="flex items-center gap-2">
                                                <Pill className="w-5 h-5 text-rose-500" />
                                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Secure Medicines Par Check</h3>
                                            </div>
                                            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest bg-rose-50 px-2.5 py-1 rounded-md">Critical</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500">
                                                    <tr>
                                                        <th className="px-5 py-3 font-semibold">Medicine Item</th>
                                                        <th className="px-5 py-3 font-semibold text-center">Required Par</th>
                                                        <th className="px-5 py-3 font-semibold w-32">Refilled Today</th>
                                                        <th className="px-5 py-3 font-semibold text-center">Deficit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {medicineChecks.map((mc, idx) => {
                                                        const med = medicineList.find(m => m.id === mc.medicineId);
                                                        return (
                                                            <tr key={idx} className={mc.shortage > 0 ? 'bg-rose-50/30' : ''}>
                                                                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{med?.name || `Med ID: ${mc.medicineId}`}</td>
                                                                <td className="px-5 py-3 text-center font-bold text-gray-500">{mc.requiredQty}</td>
                                                                <td className="px-5 py-3">
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="number" 
                                                                            min="0"
                                                                            className="w-full h-8 text-sm font-bold pl-2 pr-2 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                                                            value={mc.refilledQty}
                                                                            onChange={(e) => handleMedicineRefillChange(idx, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 text-center">
                                                                    {mc.shortage > 0 ? (
                                                                        <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded text-xs">-{mc.shortage}</span>
                                                                    ) : (
                                                                        <span className="text-green-600 font-bold"><CheckCircle className="w-4 h-4 mx-auto" /></span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Section: Closing Remarks */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Final Remarks</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
                                            <input
                                                type="text"
                                                value={missingItemsText}
                                                onChange={(e) => setMissingItemsText(e.target.value)}
                                                placeholder="Flag missing items (comma separated)"
                                                className="w-full border-0 focus:ring-0 bg-transparent text-sm font-medium"
                                            />
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 md:col-span-2">
                                            <textarea
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                placeholder="Auditor notes & internal remarks..."
                                                rows={3}
                                                className="w-full border-0 focus:ring-0 bg-transparent text-sm resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveRoomId(null)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                            >
                                Discard Form
                            </button>
                            <button
                                type="submit"
                                form="roomChecklistForm"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Complete Room Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
