'use client';

import React, { useState } from 'react';
import { useCustomerAuthStore, RegisteredUser, ConnectedPatient } from '@/lib/customer-auth-store';
import { Users, Search, Link2, Unlink, UserPlus } from 'lucide-react';
import { PatientRelationship } from '@/lib/store';

export default function ClientGroupingPage() {
    const { users, updateUser } = useCustomerAuthStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);

    // Link patient form
    const [linkPhone, setLinkPhone] = useState('');
    const [linkRelationship, setLinkRelationship] = useState<PatientRelationship>('spouse');

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone.includes(searchTerm) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleLinkPatient = () => {
        if (!selectedUser || !linkPhone) return;

        const existing: ConnectedPatient[] = selectedUser.connectedPatients || [];
        if (existing.some(p => p.patientPhone === linkPhone)) {
            alert('This patient is already connected.');
            return;
        }

        updateUser(selectedUser.id, {
            connectedPatients: [...existing, { patientPhone: linkPhone, relationship: linkRelationship }]
        });

        // Refresh selected user
        const updated = useCustomerAuthStore.getState().users.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
        setLinkPhone('');
    };

    const handleUnlinkPatient = (phone: string) => {
        if (!selectedUser) return;
        const existing: ConnectedPatient[] = selectedUser.connectedPatients || [];
        updateUser(selectedUser.id, {
            connectedPatients: existing.filter(p => p.patientPhone !== phone)
        });

        const updated = useCustomerAuthStore.getState().users.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
    };

    const getRelationshipLabel = (r: PatientRelationship) => {
        const labels: Record<PatientRelationship, string> = {
            spouse: 'Spouse', parent: 'Parent', child: 'Child', sibling: 'Sibling',
            friend: 'Friend', business_associate: 'Business Associate', other: 'Other'
        };
        return labels[r] || r;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-indigo-600" />
                        Client Grouping & Relationships
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Group clients by family or referral relationships for revenue analysis and engagement.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Client List */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input type="text" placeholder="Search clients..." className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                            {filteredUsers.map(u => (
                                <button key={u.id} className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${selectedUser?.id === u.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600' : ''}`} onClick={() => setSelectedUser(u)}>
                                    <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                                    <div className="text-xs text-gray-500">{u.phone} · {u.email}</div>
                                    {u.connectedPatients && u.connectedPatients.length > 0 && (
                                        <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> {u.connectedPatients.length} connections</div>
                                    )}
                                </button>
                            ))}
                            {filteredUsers.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">No clients found.</div>}
                        </div>
                    </div>

                    {/* Client Detail */}
                    <div className="lg:col-span-2">
                        {selectedUser ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                                <h2 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">{selectedUser.name}</h2>
                                <p className="text-sm text-gray-500 mb-6">{selectedUser.phone} · {selectedUser.email}</p>

                                {/* Connected Patients */}
                                <div className="mb-6">
                                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Link2 className="w-4 h-4" /> Connected Patients
                                    </h3>
                                    {(selectedUser.connectedPatients || []).length === 0 ? (
                                        <p className="text-sm text-gray-500">No connected patients yet.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(selectedUser.connectedPatients || []).map((cp: ConnectedPatient, idx: number) => {
                                                const linked = users.find(u => u.phone === cp.patientPhone);
                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                                        <div>
                                                            <span className="font-medium text-gray-900 dark:text-white">{linked?.name || cp.patientPhone}</span>
                                                            <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{getRelationshipLabel(cp.relationship)}</span>
                                                        </div>
                                                        <button onClick={() => handleUnlinkPatient(cp.patientPhone)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" title="Unlink"><Unlink className="w-4 h-4" /></button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Add Connection */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" /> Link New Patient
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input type="tel" placeholder="Patient phone" className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={linkPhone} onChange={(e) => setLinkPhone(e.target.value)} />
                                        <select className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm" value={linkRelationship} onChange={(e) => setLinkRelationship(e.target.value as PatientRelationship)}>
                                            <option value="spouse">Spouse</option>
                                            <option value="parent">Parent</option>
                                            <option value="child">Child</option>
                                            <option value="sibling">Sibling</option>
                                            <option value="friend">Friend</option>
                                            <option value="business_associate">Business Associate</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <button onClick={handleLinkPatient} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Link Patient</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-500">
                                Select a client from the list to view and manage their connections.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
