'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Percent } from 'lucide-react';
import { PromoCode } from '@/lib/data';

export default function AdminPromosPage() {
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newPromo, setNewPromo] = useState<Partial<PromoCode>>({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        applicableServiceIds: [],
        active: true
    });

    useEffect(() => {
        fetchPromos();
    }, []);

    const fetchPromos = async () => {
        try {
            const res = await fetch('/api/admin/promos');
            if (res.ok) {
                const data = await res.json();
                setPromos(data);
            }
        } catch (error) {
            console.error('Failed to fetch promos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/promos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPromo)
            });

            if (res.ok) {
                setIsModalOpen(false);
                setNewPromo({
                    code: '',
                    discountType: 'percentage',
                    discountValue: 0,
                    applicableServiceIds: [],
                    active: true
                });
                fetchPromos();
            }
        } catch (error) {
            console.error('Failed to create promo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this promo code?')) return;
        try {
            const res = await fetch(`/api/admin/promos?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchPromos();
            }
        } catch (error) {
            console.error('Failed to delete promo');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Tag className="h-6 w-6 text-indigo-600" />
                    Promo Codes
                </h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Create New Code
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {promos.map((promo) => (
                        <div key={promo.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 p-2 ${promo.active ? 'text-green-500' : 'text-gray-400'}`}>
                                <div className={`text-xs font-bold uppercase tracking-wider ${promo.active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100'} px-2 py-1 rounded`}>
                                    {promo.active ? 'Active' : 'Inactive'}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                                    {promo.discountType === 'percentage' ? (
                                        <Percent className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                    ) : (
                                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">د.إ</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                        {promo.code}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {promo.discountType === 'percentage'
                                            ? `${(promo.discountValue * 100).toFixed(0)}% Off`
                                            : `${promo.discountValue} AED Off`
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4 flex justify-between items-center text-sm text-gray-500">
                                <span>Used {promo.usageCount} times</span>
                                <button
                                    onClick={() => handleDelete(promo.id)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {promos.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border-dashed border-2 border-gray-200 dark:border-gray-700">
                            No promo codes found. Create one to get started.
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Promo Code</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Code Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="SUMMER20"
                                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 uppercase"
                                    value={newPromo.code}
                                    onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                                />
                            </div>

                            {/* Department Selector */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Applicable Departments (Optional)</label>
                                <div className="max-h-32 overflow-y-auto border rounded-md p-2 dark:border-gray-600">
                                    {['Cardiology', 'Dermatology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Gynecology', 'Ophthalmology', 'General Medicine'].map((dept) => (
                                        <label key={dept} className="flex items-center gap-2 py-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!newPromo.applicableDepartmentIds?.some(id => id.includes(dept))}
                                                onChange={(e) => {
                                                    const current = newPromo.applicableDepartmentIds || [];
                                                    // Note: Ideally we'd fetch actual Dept IDs. For now, constructing simplistic IDs matching data.ts pattern for demo.
                                                    // data.ts pattern: `c1-${dept}`, `c2-${dept}`, `c3-${dept}`.
                                                    // To keep it simple for this UI, we'll store just the dept Name and filter loosely, OR store all 3 variations.
                                                    // Better: Store the Dept Name as a "tag" and check if selectedDept.name matches?
                                                    // Requirement says "applicableDepartmentIds".
                                                    // Let's store "Dermatology" and update logic to check name, or fetch all IDs.
                                                    // Given existing data structure, let's fetch all clinics logic? No, too complex.
                                                    // Let's stick to storing the *names* in a new field if possible, or just hack IDs.
                                                    // Actually, `activeDepartmentIds` suggests IDs.
                                                    // Let's use a simpler approach: Store the Department Name in the ID field for now (e.g. "dept:Dermatology") and update validation?
                                                    // No, let's be strict. Let's assume we want to apply to ALL clinics' Dermatology depts.
                                                    // Let's add all 3 clinic variations for the selected dept.

                                                    const variations = [`c1-${dept}`, `c2-${dept}`, `c3-${dept}`];

                                                    let updated = [...current];
                                                    if (e.target.checked) {
                                                        updated = [...updated, ...variations];
                                                    } else {
                                                        updated = updated.filter(id => !variations.includes(id));
                                                    }
                                                    setNewPromo({ ...newPromo, applicableDepartmentIds: updated });
                                                }}
                                                className="rounded text-indigo-600"
                                            />
                                            <span className="text-sm">{dept}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Leave empty to apply to all departments.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Valid From (Optional)</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newPromo.validFrom || ''}
                                        onChange={(e) => setNewPromo({ ...newPromo, validFrom: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Valid Until (Optional)</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newPromo.validUntil || ''}
                                        onChange={(e) => setNewPromo({ ...newPromo, validUntil: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newPromo.discountType}
                                        onChange={(e) => setNewPromo({ ...newPromo, discountType: e.target.value as 'percentage' | 'fixed' })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (AED)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Value</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step={newPromo.discountType === 'percentage' ? "0.01" : "1"}
                                        placeholder={newPromo.discountType === 'percentage' ? "0.10 (10%)" : "10"}
                                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={newPromo.discountValue}
                                        onChange={(e) => setNewPromo({ ...newPromo, discountValue: parseFloat(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {newPromo.discountType === 'percentage' ? 'Enter 0.10 for 10%' : 'Enter AED amount'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Create Promo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
