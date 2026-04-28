'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, ArrowLeftRight, History, AlertTriangle, Wrench,
    Package, MapPin, Filter, X, ChevronDown, ChevronUp, Calendar, Shield, Printer
} from 'lucide-react';
import { User } from '@/lib/users-types';

interface EquipmentItem {
    id: string;
    name: string;
    code: string;
    category: string;
    brand: string;
    serialNumber: string;
    quantity: number;
    branchId: string;
    purchaseDate: string;
    warrantyExpiry: string;
    status: 'active' | 'maintenance' | 'damaged' | 'disposed';
    assignedDepartment: string;
    notes: string;
    lowStockThreshold: number;
    nextMaintenanceDate?: string;
}

interface HistoryEntry {
    id: string;
    equipmentId: string;
    action: string;
    fromBranch?: string;
    toBranch?: string;
    notes: string;
    timestamp: string;
    quantityChanged?: number;
}

interface Branch { id: string; name: string; }

const BRANCHES: Branch[] = [
    { id: 'clinic-1', name: 'Al Muraqabat Branch' },
    { id: 'clinic-2', name: 'Al Qiyadah Branch' },
    { id: 'clinic-3', name: 'Silicon Oasis Branch' },
];

const CATEGORIES = [
    'Medical Device', 'Laser Equipment', 'Diagnostic', 'Surgical Instrument',
    'Infection Control', 'Furniture', 'IT Equipment', 'Other'
];

const STATUS_OPTIONS: { value: EquipmentItem['status']; label: string; color: string }[] = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'maintenance', label: 'Under Maintenance', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { value: 'damaged', label: 'Damaged', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    { value: 'disposed', label: 'Disposed', color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
];

const branchName = (id: string) => BRANCHES.find(b => b.id === id)?.name || id;

const emptyForm: Omit<EquipmentItem, 'id'> = {
    name: '', code: '', category: '', brand: '', serialNumber: '', quantity: 1,
    branchId: BRANCHES[0].id, purchaseDate: '', warrantyExpiry: '',
    status: 'active', assignedDepartment: '', notes: '', lowStockThreshold: 1,
    nextMaintenanceDate: '',
};

export default function EquipmentPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [items, setItems] = useState<EquipmentItem[]>([]);
    const [clinicsData, setClinicsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterBranch, setFilterBranch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState('');
    const [transferItem, setTransferItem] = useState<EquipmentItem | null>(null);
    const [transferBranch, setTransferBranch] = useState('');
    const [transferQty, setTransferQty] = useState(1);
    const [transferNotes, setTransferNotes] = useState('');
    const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
    const [historyItemName, setHistoryItemName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dashboardOpen, setDashboardOpen] = useState(true);

    // ── Fetch ──
    const fetchItems = async () => {
        try {
            const res = await fetch(`/api/admin/equipment?_t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (Array.isArray(data)) setItems(data);
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    useEffect(() => {
        const userStr = sessionStorage.getItem('adminUser');
        if (userStr) {
            try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
        }
        fetchItems();
        fetch('/api/admin/clinics').then(r => r.json()).then(d => setClinicsData(d || [])).catch(() => {});
    }, []);

    // ── Filtered list ──
    const filtered = items.filter(i => {
        // Enforce RBAC Branch Scoping
        if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
            if (!currentUser.clinicIds?.includes(i.branchId)) return false;
        }

        if (filterBranch && i.branchId !== filterBranch) return false;
        if (filterCategory && i.category !== filterCategory) return false;
        if (filterStatus && i.status !== filterStatus) return false;
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    // ── RBAC Safe Stats ──
    const safeItems = items.filter(i => {
        if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
            return currentUser.clinicIds?.includes(i.branchId);
        }
        return true;
    });

    const totalCount = safeItems.length;
    const totalQty = safeItems.reduce((s, i) => s + i.quantity, 0);
    const branchCounts = BRANCHES
        .filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id))
        .map(b => ({ ...b, count: safeItems.filter(i => i.branchId === b.id).length }));
    const maintenanceCount = safeItems.filter(i => i.status === 'maintenance').length;
    const damagedCount = safeItems.filter(i => i.status === 'damaged').length;
    const lowStockItems = safeItems.filter(i => i.quantity <= i.lowStockThreshold && i.status === 'active');
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 86400000);
    const maintenanceDue = safeItems.filter(i => i.nextMaintenanceDate && new Date(i.nextMaintenanceDate) <= in7Days && i.status === 'active');

    // ── Handlers ──
    const syncEquipmentToRoom = async (branchId: string, eqId: string, targetRoomId: string) => {
        const clinic = clinicsData.find(c => c.id === branchId);
        if (!clinic) return;
        const updatedRooms = clinic.rooms?.map((r: any) => {
            const cleanEqs = (r.assignedEquipmentIds || []).filter((id: string) => id !== eqId);
            if (r.id === targetRoomId) return { ...r, assignedEquipmentIds: [...cleanEqs, eqId] };
            return { ...r, assignedEquipmentIds: cleanEqs };
        });
        await fetch('/api/admin/clinics', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: branchId, rooms: updatedRooms })
        });
        fetch('/api/admin/clinics').then(r => r.json()).then(d => setClinicsData(d || [])).catch(() => {});
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const newItem = await res.json();
            
            if (formData.assignedDepartment) {
                await syncEquipmentToRoom(formData.branchId, newItem.id, formData.assignedDepartment);
            }
            
            await fetchItems();
            setShowAddModal(false);
            setFormData(emptyForm);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await fetch('/api/admin/equipment', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingId, ...formData }),
            });
            
            await syncEquipmentToRoom(formData.branchId, editingId, formData.assignedDepartment);
            
            await fetchItems();
            setShowEditModal(false);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this equipment item?')) return;
        await fetch(`/api/admin/equipment?id=${id}`, { method: 'DELETE' });
        await fetchItems();
    };

    const openEdit = (item: EquipmentItem) => {
        setEditingId(item.id);
        setFormData({
            name: item.name, code: item.code || '', category: item.category, brand: item.brand,
            serialNumber: item.serialNumber, quantity: item.quantity,
            branchId: item.branchId, purchaseDate: item.purchaseDate,
            warrantyExpiry: item.warrantyExpiry, status: item.status,
            assignedDepartment: item.assignedDepartment, notes: item.notes,
            lowStockThreshold: item.lowStockThreshold,
            nextMaintenanceDate: item.nextMaintenanceDate || '',
        });
        setShowEditModal(true);
    };

    const openTransfer = (item: EquipmentItem) => {
        setTransferItem(item);
        setTransferBranch(BRANCHES.find(b => b.id !== item.branchId)?.id || '');
        setTransferQty(1);
        setTransferNotes('');
        setShowTransferModal(true);
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferItem) return;
        setSubmitting(true);
        try {
            await fetch('/api/admin/equipment', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer',
                    id: transferItem.id,
                    toBranchId: transferBranch,
                    quantity: transferQty,
                    notes: transferNotes,
                }),
            });
            await fetchItems();
            setShowTransferModal(false);
        } catch { /* ignore */ } finally { setSubmitting(false); }
    };

    const openHistory = async (item: EquipmentItem) => {
        setHistoryItemName(item.name);
        setShowHistoryModal(true);
        try {
            const res = await fetch(`/api/admin/equipment?historyFor=${item.id}`);
            const data = await res.json();
            setHistoryData(Array.isArray(data) ? data : []);
        } catch { setHistoryData([]); }
    };

    const statusBadge = (status: string) => {
        const s = STATUS_OPTIONS.find(o => o.value === status);
        return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s?.color || ''}`}>{s?.label || status}</span>;
    };

    const handlePrintItem = (item: EquipmentItem) => {
        const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;
        const statusColor = (s: string) => {
            if (s === 'active') return '#15803d';
            if (s === 'maintenance') return '#b45309';
            if (s === 'damaged') return '#dc2626';
            return '#6b7280';
        };
        const statusBg = (s: string) => {
            if (s === 'active') return '#dcfce7';
            if (s === 'maintenance') return '#fef3c7';
            if (s === 'damaged') return '#fee2e2';
            return '#f3f4f6';
        };
        const isLow = item.quantity <= item.lowStockThreshold && item.status === 'active';
        const warrantyExpired = item.warrantyExpiry && new Date(item.warrantyExpiry) < today;
        const field = (label: string, value: string, highlight?: string) =>
            `<div class="field">
                <div class="field-label">${label}</div>
                <div class="field-value" ${highlight ? `style="color:${highlight}"` : ''}>${value || '—'}</div>
            </div>`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Equipment Detail — ${item.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #4f46e5; }
  .header-left h1 { font-size: 22px; font-weight: 800; color: #1e1b4b; margin-bottom: 2px; }
  .header-left p { font-size: 11px; color: #6b7280; }
  .meta { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.6; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 11px; margin-top: 8px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e0e7ff; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
  .field-label { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
  .field-value { font-size: 13px; font-weight: 600; color: #1f2937; }
  .alert-box { border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .alert-box.red { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .alert-box.amber { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #374151; min-height: 50px; }
  .footer { margin-top: 28px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>🏥 Equipment Detail Report</h1>
    <p>Dubai First Medical Center — Equipment Management System</p>
    <div class="status-badge" style="background:${statusBg(item.status)};color:${statusColor(item.status)}">${statusLabel(item.status)}</div>
  </div>
  <div class="meta">
    <div><strong>Printed:</strong> ${new Date().toLocaleString()}</div>
    <div><strong>Branch:</strong> ${branchName(item.branchId)}</div>
    <div><strong>ID:</strong> ${item.id}</div>
  </div>
</div>

${isLow ? `<div class="alert-box red">⚠ Low Stock Alert — Quantity (${item.quantity}) is at or below threshold (${item.lowStockThreshold})</div>` : ''}
${warrantyExpired ? `<div class="alert-box amber">⏰ Warranty Expired — expired on ${item.warrantyExpiry}</div>` : ''}

<div class="section">
  <div class="section-title">Equipment Information</div>
  <div class="grid">
    ${field('Equipment Name', item.name)}
    ${field('Equipment Code', item.code)}
    ${field('Brand / Model', item.brand)}
    ${field('Serial Number', item.serialNumber)}
    ${field('Category', item.category)}
    ${field('Branch / Location', branchName(item.branchId))}
    ${field('Assigned Department', item.assignedDepartment)}
  </div>
</div>

<div class="section">
  <div class="section-title">Stock & Status</div>
  <div class="grid">
    ${field('Quantity', String(item.quantity), isLow ? '#dc2626' : undefined)}
    ${field('Low Stock Threshold', String(item.lowStockThreshold))}
    ${field('Status', statusLabel(item.status), statusColor(item.status))}
  </div>
</div>

<div class="section">
  <div class="section-title">Dates & Warranty</div>
  <div class="grid">
    ${field('Purchase Date', item.purchaseDate)}
    ${field('Warranty Expiry', item.warrantyExpiry, warrantyExpired ? '#dc2626' : undefined)}
    ${field('Next Maintenance', item.nextMaintenanceDate || '')}
  </div>
</div>

<div class="section">
  <div class="section-title">Notes</div>
  <div class="notes-box">${item.notes || 'No notes recorded.'}</div>
</div>

<div class="footer">Dubai First Medical Center · Confidential · Generated by Equipment Management System</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) { win.document.write(html); win.document.close(); }
    };

    const handlePrint = () => {
        const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;
        const filterDesc = [
            filterBranch ? `Branch: ${branchName(filterBranch)}` : 'All Branches',
            filterCategory ? `Category: ${filterCategory}` : 'All Categories',
            filterStatus ? `Status: ${statusLabel(filterStatus)}` : 'All Statuses',
            searchTerm ? `Search: "${searchTerm}"` : '',
        ].filter(Boolean).join(' · ');

        const rows = filtered.map(item => {
            const isLow = item.quantity <= item.lowStockThreshold && item.status === 'active';
            const warrantyExpired = item.warrantyExpiry && new Date(item.warrantyExpiry) < today;
            return `<tr>
                <td>${item.name}${item.code ? `<br/><small style="color:#0d9488;font-family:monospace;font-weight:700">${item.code}</small>` : ''}${item.brand ? `<br/><small style="color:#6b7280">${item.brand}</small>` : ''}${item.serialNumber ? `<br/><small style="color:#6b7280">SN: ${item.serialNumber}</small>` : ''}</td>
                <td>${item.category}</td>
                <td>${branchName(item.branchId)}</td>
                <td style="text-align:center;font-weight:bold;color:${isLow ? '#dc2626' : '#111827'}">${item.quantity}${isLow ? ' ⚠' : ''}</td>
                <td>${statusLabel(item.status)}</td>
                <td style="color:${warrantyExpired ? '#dc2626' : '#374151'};${warrantyExpired ? 'text-decoration:line-through' : ''}">${item.warrantyExpiry || '—'}</td>
                <td>${item.nextMaintenanceDate || '—'}</td>
                <td>${item.notes || '—'}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Equipment Inventory Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 24px; font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #4f46e5; }
  .header h1 { font-size: 20px; font-weight: 700; color: #1e1b4b; }
  .header p { font-size: 10px; color: #6b7280; margin-top: 3px; }
  .meta { text-align: right; font-size: 10px; color: #6b7280; }
  .stats { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat-card { background: #f5f3ff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 10px 16px; min-width: 100px; text-align: center; }
  .stat-card .val { font-size: 22px; font-weight: 700; color: #4f46e5; }
  .stat-card .lbl { font-size: 9px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .stat-card.amber .val { color: #d97706; } .stat-card.amber { background: #fffbeb; border-color: #fde68a; } .stat-card.amber .lbl { color: #d97706; }
  .stat-card.red .val { color: #dc2626; } .stat-card.red { background: #fef2f2; border-color: #fecaca; } .stat-card.red .lbl { color: #dc2626; }
  .stat-card.blue .val { color: #2563eb; } .stat-card.blue { background: #eff6ff; border-color: #bfdbfe; } .stat-card.blue .lbl { color: #2563eb; }
  .filters { font-size: 10px; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #4f46e5; color: #fff; }
  thead th { padding: 7px 8px; text-align: left; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr:hover { background: #f5f3ff; }
  td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #f3f4f6; font-size: 10.5px; }
  small { font-size: 9px; }
  .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🏥 Equipment Inventory Report</h1>
    <p>Dubai First Medical Center — Equipment Management System</p>
  </div>
  <div class="meta">
    <div>Printed: ${new Date().toLocaleString()}</div>
    <div>Total shown: ${filtered.length} item(s)</div>
  </div>
</div>
<div class="stats">
  <div class="stat-card"><div class="val">${totalCount}</div><div class="lbl">Total Items</div></div>
  ${branchCounts.map(b => `<div class="stat-card blue"><div class="val">${b.count}</div><div class="lbl">${b.name.replace(' Branch', '')}</div></div>`).join('')}
  <div class="stat-card amber"><div class="val">${maintenanceCount}</div><div class="lbl">Maintenance</div></div>
  <div class="stat-card red"><div class="val">${damagedCount}</div><div class="lbl">Damaged</div></div>
  <div class="stat-card amber"><div class="val">${lowStockItems.length}</div><div class="lbl">Low Stock</div></div>
</div>
<div class="filters">🔍 Filters applied: ${filterDesc}</div>
<table>
<thead><tr>
  <th>Equipment</th><th>Category</th><th>Branch</th><th>Qty</th><th>Status</th><th>Warranty</th><th>Next Maintenance</th><th>Notes</th>
</tr></thead>
<tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#9ca3af">No records found</td></tr>'}</tbody>
</table>
<div class="footer">Dubai First Medical Center · Confidential · Generated by Equipment Management System</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

        const win = window.open('', '_blank', 'width=1100,height=750');
        if (win) { win.document.write(html); win.document.close(); }
    };

    // ── Form fields (shared by Add and Edit) ──
    const renderFormFields = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium mb-1">Equipment Name *</label>
                <input required type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Equipment Code</label>
                <input type="text" placeholder="e.g. EQ-001, LASER-02" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Brand / Model</label>
                <input type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <input type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Quantity *</label>
                <input required type="number" min="1" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <input type="number" min="0" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Branch *</label>
                <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.branchId} onChange={e => setFormData({ ...formData, branchId: e.target.value })}>
                    {BRANCHES.filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id)).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as EquipmentItem['status'] })}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Purchase Date</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Warranty Expiry</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.warrantyExpiry} onChange={e => setFormData({ ...formData, warrantyExpiry: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Next Maintenance Date</label>
                <input type="date" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.nextMaintenanceDate || ''} onChange={e => setFormData({ ...formData, nextMaintenanceDate: e.target.value })} />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Assigned Department / Room</label>
                <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.assignedDepartment} 
                    onChange={e => setFormData({ ...formData, assignedDepartment: e.target.value })}>
                    <option value="">-- Unassigned --</option>
                    {clinicsData.find(c => c.id === formData.branchId)?.rooms?.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                    ))}
                </select>
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-gray-500">Loading equipment...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equipment Inventory</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Track, manage, and transfer equipment across all branches</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                        <button onClick={() => { 
                            const allowedBranches = BRANCHES.filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id));
                            setFormData({
                                ...emptyForm,
                                branchId: allowedBranches.length > 0 ? allowedBranches[0].id : ''
                            }); 
                            setShowAddModal(true); 
                        }}
                            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                            <Plus className="w-4 h-4" /> Add Equipment
                        </button>
                    </div>
                </div>

                {/* ── Alerts ── */}
                {(lowStockItems.length > 0 || maintenanceDue.length > 0) && (
                    <div className="space-y-2">
                        {lowStockItems.length > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Low Stock Alert</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">{lowStockItems.map(i => `${i.name} (${branchName(i.branchId)} — Qty: ${i.quantity})`).join(', ')}</p>
                                </div>
                            </div>
                        )}
                        {maintenanceDue.length > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <Wrench className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Maintenance Reminder</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">{maintenanceDue.map(i => `${i.name} — due ${i.nextMaintenanceDate}`).join(', ')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Dashboard Summary ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <button onClick={() => setDashboardOpen(!dashboardOpen)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-500" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">Dashboard Summary</span>
                        </div>
                        {dashboardOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {dashboardOpen && (
                        <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalCount}</p>
                                <p className="text-[11px] text-indigo-500 font-medium">Total Items</p>
                            </div>
                            {branchCounts.map(b => (
                                <div key={b.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{b.count}</p>
                                    <p className="text-[11px] text-blue-500 font-medium truncate">{b.name.replace(' Branch', '')}</p>
                                </div>
                            ))}
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{maintenanceCount}</p>
                                <p className="text-[11px] text-amber-500 font-medium">Maintenance</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{damagedCount}</p>
                                <p className="text-[11px] text-red-500 font-medium">Damaged</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Filter Bar ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                            <option value="">All Branches</option>
                            {BRANCHES.filter(b => currentUser?.role === 'SUPER_ADMIN' || currentUser?.clinicIds?.includes(b.id)).map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Name or serial number..."
                                className="w-full pl-9 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* ── Equipment Table ── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="px-4 py-3">Equipment</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Branch</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Warranty</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filtered.map(item => {
                                    const isLow = item.quantity <= item.lowStockThreshold && item.status === 'active';
                                    const isMaintSoon = item.nextMaintenanceDate && new Date(item.nextMaintenanceDate) <= in7Days && item.status === 'active';
                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${isLow ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                                    {item.code && <p className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400">{item.code}</p>}
                                                    <p className="text-xs text-gray-500">{item.brand} {item.serialNumber ? `· SN: ${item.serialNumber}` : ''}</p>
                                                    {item.assignedDepartment && <p className="text-xs text-indigo-500">{item.assignedDepartment}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.category}</td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                                                    <MapPin className="w-3 h-3" />{branchName(item.branchId).replace(' Branch', '')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{item.quantity}</span>
                                                {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                                            </td>
                                            <td className="px-4 py-3">
                                                {statusBadge(item.status)}
                                                {isMaintSoon && (
                                                    <span className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
                                                        <Wrench className="w-3 h-3" /> Maint. due
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {item.warrantyExpiry ? (
                                                    <span className={new Date(item.warrantyExpiry) < today ? 'text-red-500 line-through' : ''}>
                                                        {item.warrantyExpiry}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEdit(item)} title="Edit"
                                                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500 transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => openTransfer(item)} title="Transfer"
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">
                                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => openHistory(item)} title="History"
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                                                        <History className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handlePrintItem(item)} title="Print Details"
                                                        className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 transition-colors">
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} title="Delete"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            {items.length === 0 ? 'No equipment added yet. Click "Add Equipment" to get started.' : 'No equipment matches the current filters.'}
                        </div>
                    )}
                </div>

                {/* ── Add Modal ── */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Equipment</h2>
                                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleAdd} className="p-6">
                                {renderFormFields()}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                        {submitting ? 'Adding...' : 'Add Equipment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Edit Modal ── */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Equipment</h2>
                                <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleEdit} className="p-6">
                                {renderFormFields()}
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Transfer Modal ── */}
                {showTransferModal && transferItem && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transfer Equipment</h2>
                                <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <form onSubmit={handleTransfer} className="p-6 space-y-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{transferItem.name}</p>
                                    <p className="text-xs text-gray-500">From: {branchName(transferItem.branchId)} · Available: {transferItem.quantity}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Transfer To *</label>
                                    <select required className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferBranch} onChange={e => setTransferBranch(e.target.value)}>
                                        <option value="">Select Branch</option>
                                        {BRANCHES.filter(b => b.id !== transferItem.branchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity</label>
                                    <input type="number" min="1" max={transferItem.quantity} required
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferQty} onChange={e => setTransferQty(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Reason for transfer..." />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                    <button type="submit" disabled={submitting}
                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2">
                                        <ArrowLeftRight className="w-4 h-4" /> {submitting ? 'Transferring...' : 'Transfer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── History Modal ── */}
                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">History: {historyItemName}</h2>
                                <button onClick={() => setShowHistoryModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                {historyData.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-8">No history found.</p>
                                ) : (
                                    historyData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(h => (
                                        <div key={h.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                h.action === 'new_entry' ? 'bg-green-100 text-green-600' :
                                                h.action === 'transfer' ? 'bg-blue-100 text-blue-600' :
                                                h.action === 'maintenance' ? 'bg-amber-100 text-amber-600' :
                                                h.action === 'damage' ? 'bg-red-100 text-red-600' :
                                                h.action === 'disposal' ? 'bg-gray-200 text-gray-600' :
                                                'bg-indigo-100 text-indigo-600'
                                            }`}>
                                                {h.action === 'transfer' ? <ArrowLeftRight className="w-4 h-4" /> :
                                                 h.action === 'maintenance' ? <Wrench className="w-4 h-4" /> :
                                                 h.action === 'new_entry' ? <Plus className="w-4 h-4" /> :
                                                 <History className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{h.action.replace('_', ' ')}</p>
                                                <p className="text-xs text-gray-500">{h.notes}</p>
                                                {h.fromBranch && <p className="text-xs text-gray-400">{branchName(h.fromBranch)} → {branchName(h.toBranch || '')}</p>}
                                                <p className="text-[10px] text-gray-400 mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
