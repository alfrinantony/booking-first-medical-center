'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { RegisteredCustomer as RegisteredUser } from '@/lib/customer-auth-server-store';
import {
    Users, Search, Shield, ShieldOff, KeyRound, Edit2, Trash2, X,
    Merge, Check, Mail, Phone, Calendar, Ban, CheckCircle2,
    AlertTriangle, Eye, EyeOff, User, Download, Loader2
} from 'lucide-react';
import { maskPhone, maskEmail } from '@/lib/mask-utils';

export default function RegisteredUsersPage() {
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/registered-users');
            if (res.ok) {
                setUsers(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const apiAction = async (payload: any) => {
        try {
            const res = await fetch('/api/admin/registered-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                await loadUsers();
                return true;
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    };

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'unverified'>('all');

    // Edit modal
    const [editUser, setEditUser] = useState<RegisteredUser | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');

    // Reset password modal
    const [resetUser, setResetUser] = useState<RegisteredUser | null>(null);
    const [newPw, setNewPw] = useState('');
    const [showPw, setShowPw] = useState(false);

    // Merge modal
    const [mergeMode, setMergeMode] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [mergeTarget, setMergeTarget] = useState<string | null>(null);

    // View modal
    const [viewUser, setViewUser] = useState<RegisteredUser | null>(null);

    // Contact masking
    const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set());
    const toggleContactReveal = (id: string) => {
        setRevealedContacts(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Feedback
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
        setFeedback({ type, msg });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    // SimplyBook import state
    const [importingSB, setImportingSB] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number; tempPassword: string } | null>(null);

    const handleImportFromSB = async () => {
        if (!confirm(
            'This will create registered user accounts for all SimplyBook clients who have an email address.\n\n' +
            'Temporary password: FMC@2026\n\n' +
            'Accounts are created as pre-verified. Existing accounts are skipped. Continue?'
        )) return;
        setImportingSB(true);
        setImportResult(null);
        try {
            const res = await fetch('/api/admin/simplybook/import-registered-users', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                setImportResult({ imported: data.imported, skipped: data.skipped, total: data.total, tempPassword: data.tempPassword });
                await loadUsers();
                showFeedback('success', `Imported ${data.imported} SimplyBook users.`);
            } else {
                showFeedback('error', 'Import failed: ' + (data.error || 'Unknown error'));
            }
        } catch {
            showFeedback('error', 'Import failed. Check console for details.');
        } finally {
            setImportingSB(false);
        }
    };

    /* ── Filtering ── */
    const filtered = users.filter(u => {
        if (statusFilter === 'active' && (u.blocked || !u.emailVerified)) return false;
        if (statusFilter === 'blocked' && !u.blocked) return false;
        if (statusFilter === 'unverified' && u.emailVerified) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.phone || '').includes(q) ||
                u.id.toLowerCase().includes(q)
            );
        }
        return true;
    });

    /* ── Stats ── */
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.emailVerified && !u.blocked).length;
    const blockedUsers = users.filter(u => u.blocked).length;
    const unverifiedUsers = users.filter(u => !u.emailVerified).length;

    /* ── Handlers ── */

    const handleBlock = async (id: string) => {
        if (!confirm('Block this user from logging in?')) return;
        const ok = await apiAction({ action: 'block', id });
        if (ok) showFeedback('success', 'User blocked.');
    };

    const handleUnblock = async (id: string) => {
        const ok = await apiAction({ action: 'unblock', id });
        if (ok) showFeedback('success', 'User unblocked.');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Permanently delete this user account? This cannot be undone.')) return;
        const ok = await apiAction({ action: 'remove', id });
        if (ok) showFeedback('success', 'User deleted.');
    };

    const openEdit = (u: RegisteredUser) => {
        setEditUser(u);
        setEditName(u.name);
        setEditEmail(u.email);
        setEditPhone(u.phone || '');
    };

    const saveEdit = async () => {
        if (!editUser) return;
        const ok = await apiAction({ action: 'update', id: editUser.id, updates: { name: editName, email: editEmail, phone: editPhone } });
        if (ok) {
            setEditUser(null);
            showFeedback('success', 'User updated.');
        }
    };

    const openReset = (u: RegisteredUser) => {
        setResetUser(u);
        setNewPw('');
        setShowPw(false);
    };

    const saveReset = async () => {
        if (!resetUser || newPw.length < 4) {
            showFeedback('error', 'Password must be at least 4 characters.');
            return;
        }
        const ok = await apiAction({ action: 'resetPassword', id: resetUser.id, newPassword: newPw });
        if (ok) {
            setResetUser(null);
            showFeedback('success', 'Password reset.');
        }
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleMerge = async () => {
        if (selected.length !== 2 || !mergeTarget) return;
        const sourceId = selected.find(id => id !== mergeTarget)!;
        if (!confirm(`Merge user into the selected target? The source account will be removed.`)) return;
        const ok = await apiAction({ action: 'merge', id: mergeTarget, sourceId });
        if (ok) {
            setSelected([]);
            setMergeTarget(null);
            setMergeMode(false);
            showFeedback('success', 'Users merged successfully.');
        }
    };

    const getStatusBadge = (u: RegisteredUser) => {
        if (u.blocked) return (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-full font-medium">
                <Ban className="w-3 h-3" /> Blocked
            </span>
        );
        if (!u.emailVerified) return (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" /> Unverified
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3" /> Active
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-indigo-600" />
                            Registered Users
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Manage customer accounts — block, edit, reset passwords, merge duplicates.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleImportFromSB}
                            disabled={importingSB}
                            className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                            {importingSB ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {importingSB ? 'Importing...' : 'Import from SimplyBook'}
                        </button>
                        <button
                            onClick={() => { setMergeMode(!mergeMode); setSelected([]); setMergeTarget(null); }}
                            className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm ${
                                mergeMode
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            <Merge className="w-4 h-4" />
                            {mergeMode ? 'Cancel Merge' : 'Merge Duplicates'}
                        </button>
                    </div>
                </header>

                {/* Import result banner */}
                {importResult && (
                    <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">
                            ✓ SimplyBook import complete — {importResult.imported} imported, {importResult.skipped} skipped (out of {importResult.total} total).
                            {importResult.imported > 0 && (
                                <> Temporary password: <code className="font-mono bg-violet-100 dark:bg-violet-800/50 px-1 rounded">{importResult.tempPassword}</code></>                            )}
                        </span>
                        <button onClick={() => setImportResult(null)} className="text-violet-500 hover:text-violet-700 ml-4">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Feedback */}
                {feedback && (
                    <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${feedback.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                        {feedback.msg}
                    </div>
                )}

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button onClick={() => setStatusFilter('all')} className={`text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 transition-colors ${statusFilter === 'all' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Users</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalUsers}</div>
                    </button>
                    <button onClick={() => setStatusFilter('active')} className={`text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 transition-colors ${statusFilter === 'active' ? 'border-green-400 ring-2 ring-green-200' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">{activeUsers}</div>
                    </button>
                    <button onClick={() => setStatusFilter('blocked')} className={`text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 transition-colors ${statusFilter === 'blocked' ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Blocked</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">{blockedUsers}</div>
                    </button>
                    <button onClick={() => setStatusFilter('unverified')} className={`text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 transition-colors ${statusFilter === 'unverified' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Unverified</div>
                        <div className="text-2xl font-bold text-amber-600 mt-1">{unverifiedUsers}</div>
                    </button>
                </div>

                {/* Merge instructions */}
                {mergeMode && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 mb-6 text-sm text-indigo-800 dark:text-indigo-200">
                        <strong>Merge Mode:</strong> Select exactly 2 users by clicking their checkboxes, then choose one as the <em>target</em> (keeper). The other account&apos;s details will be merged in and the duplicate removed.
                        {selected.length === 2 && (
                            <div className="mt-3 flex items-center gap-3">
                                <span className="font-medium">Target (keep):</span>
                                {selected.map(id => {
                                    const u = users.find(x => x.id === id);
                                    return (
                                        <button key={id} onClick={() => setMergeTarget(id)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mergeTarget === id
                                                ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border'}`}>
                                            {u?.name || id}
                                        </button>
                                    );
                                })}
                                {mergeTarget && (
                                    <button onClick={handleMerge}
                                        className="ml-auto px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1">
                                        <Check className="w-4 h-4" /> Confirm Merge
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Search */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Search by name, email, phone, or ID..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    {mergeMode && <th className="p-4 w-10"></th>}
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">User</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Email</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Phone</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Status</th>
                                    <th className="text-left p-4 font-medium text-gray-500 text-sm">Registered</th>
                                    <th className="text-center p-4 font-medium text-gray-500 text-sm">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={mergeMode ? 7 : 6} className="text-center py-12 text-gray-500">
                                        {totalUsers === 0 ? 'No registered users yet.' : 'No users match your filters.'}
                                    </td></tr>
                                ) : filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        {mergeMode && (
                                            <td className="p-4">
                                                <input type="checkbox"
                                                    checked={selected.includes(u.id)}
                                                    onChange={() => toggleSelect(u.id)}
                                                    disabled={selected.length >= 2 && !selected.includes(u.id)}
                                                    className="w-4 h-4 text-indigo-600 rounded" />
                                            </td>
                                        )}
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{u.id}</div>
                                            {(u as any).source === 'simplybook' && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full mt-0.5">
                                                    SimplyBook
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                {revealedContacts.has(u.id) ? u.email : maskEmail(u.email)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                {u.phone ? (
                                                    <>
                                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                        {revealedContacts.has(u.id) ? u.phone : maskPhone(u.phone)}
                                                    </>
                                                ) : '—'}
                                                <button onClick={() => toggleContactReveal(u.id)} className="p-0.5 text-gray-400 hover:text-indigo-600 rounded transition-colors ml-1" title={revealedContacts.has(u.id) ? 'Hide' : 'Reveal'}>
                                                    {revealedContacts.has(u.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4">{getStatusBadge(u)}</td>
                                        <td className="p-4 text-sm text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                {new Date(u.createdAt).toLocaleDateString('en-AE', { dateStyle: 'medium' })}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={() => setViewUser(u)} title="View details"
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openEdit(u)} title="Edit"
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openReset(u)} title="Reset password"
                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                                                    <KeyRound className="w-4 h-4" />
                                                </button>
                                                {u.blocked ? (
                                                    <button onClick={() => handleUnblock(u.id)} title="Unblock"
                                                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                                                        <ShieldOff className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleBlock(u.id)} title="Block"
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                        <Shield className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(u.id)} title="Delete"
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── View Modal ── */}
            {viewUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-600" /> {viewUser.name}
                            </h2>
                            <button onClick={() => setViewUser(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Email</div>
                                    <div className="font-medium">{revealedContacts.has(viewUser.id) ? viewUser.email : maskEmail(viewUser.email)}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Phone</div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{revealedContacts.has(viewUser.id) ? (viewUser.phone || '—') : maskPhone(viewUser.phone)}</span>
                                        <button onClick={() => toggleContactReveal(viewUser.id)} className="p-0.5 text-gray-400 hover:text-indigo-600 rounded transition-colors" title={revealedContacts.has(viewUser.id) ? 'Hide' : 'Reveal'}>
                                            {revealedContacts.has(viewUser.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Gender</div>
                                    <div className="font-medium capitalize">{viewUser.gender || '—'}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Date of Birth</div>
                                    <div className="font-medium">{viewUser.dateOfBirth || '—'}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Status</div>
                                    <div>{getStatusBadge(viewUser)}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">Registered</div>
                                    <div className="font-medium">{new Date(viewUser.createdAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                                <div className="text-xs text-gray-500 mb-1">User ID</div>
                                <div className="font-mono text-xs">{viewUser.id}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ── */}
            {editUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Edit User</h2>
                            <button onClick={() => setEditUser(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setEditUser(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                                <button onClick={saveEdit} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {resetUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Reset Password</h2>
                            <button onClick={() => setResetUser(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Set a new password for <strong>{resetUser.name}</strong> ({resetUser.email})</p>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                className="w-full p-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                placeholder="New password (min 4 chars)"
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setResetUser(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                            <button onClick={saveReset} className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">Reset Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
