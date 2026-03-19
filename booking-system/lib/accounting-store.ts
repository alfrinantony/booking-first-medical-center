// ─────────────────────────────────────────────────────────────
// Accounting Store — Chart of Accounts, Transactions, Reports
// Organised like QuickBooks with Account Types & Detail Types
// ─────────────────────────────────────────────────────────────

import { loadFromBlob, saveToBlob } from './blob-persistence';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COST_OF_GOODS_SOLD';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'JOURNAL';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';

export const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COST_OF_GOODS_SOLD'];

// QuickBooks-style detail types per account type
export const DETAIL_TYPES: Record<AccountType, string[]> = {
    ASSET: [
        'Bank',
        'Accounts Receivable (A/R)',
        'Other Current Assets',
        'Fixed Assets',
        'Other Assets',
    ],
    LIABILITY: [
        'Accounts Payable (A/P)',
        'Credit Card',
        'Other Current Liabilities',
        'Long-Term Liabilities',
    ],
    EQUITY: [
        'Owner\'s Equity',
        'Retained Earnings',
        'Partner\'s Equity',
    ],
    REVENUE: [
        'Service Income',
        'Sales of Product Income',
        'Other Income',
        'Discount Given',
    ],
    EXPENSE: [
        'Advertising & Marketing',
        'Auto & Transport',
        'Bank Charges & Fees',
        'Cost of Labour',
        'Dues & Subscriptions',
        'Equipment Rental',
        'Insurance',
        'Interest Paid',
        'Legal & Professional Fees',
        'Meals & Entertainment',
        'Office / General & Administrative',
        'Other Business Expenses',
        'Payroll Expenses',
        'Rent or Lease',
        'Repair & Maintenance',
        'Supplies',
        'Taxes & Licences',
        'Travel',
        'Utilities',
        'Depreciation',
    ],
    COST_OF_GOODS_SOLD: [
        'Cost of Sales – Products',
        'Cost of Sales – Services',
    ],
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    REVENUE: 'Income',
    EXPENSE: 'Expenses',
    COST_OF_GOODS_SOLD: 'Cost of Goods Sold',
};

export interface Account {
    id: string;
    code: string;        // e.g. "1000", "2000", "4000"
    name: string;
    type: AccountType;
    detailType: string;  // QuickBooks sub-category, e.g. "Bank", "Fixed Assets"
    parentId?: string;   // for sub-accounts
    description?: string;
    balance: number;     // current balance in AED
    isActive: boolean;
    createdAt: string;
}

export interface Transaction {
    id: string;
    date: string;        // ISO YYYY-MM-DD
    type: TransactionType;
    description: string;
    reference?: string;  // invoice #, receipt #, etc.
    accountId: string;   // primary account
    toAccountId?: string; // for transfers/journal entries
    amount: number;      // positive = debit to accountId
    paymentMethod?: PaymentMethod;
    branchId?: string;   // clinic-1, clinic-2, etc.
    branchName?: string;
    category?: string;
    employeeId?: string;   // link transaction to a specific employee
    employeeName?: string; // employee name for display
    attachmentName?: string;
    notes?: string;
    createdBy?: string;
    createdAt: string;
}

// Common employee expense categories
export const EMPLOYEE_EXPENSE_CATEGORIES = [
    'Visa Processing',
    'Labour Card',
    'Emirates ID',
    'Medical Insurance',
    'DHA License',
    'Flight Ticket',
    'Training',
    'Uniform & Attire',
    'Accommodation',
    'Transportation',
    'Medical Tests',
    'Background Check',
    'Typing & Translation',
    'Other Employee Expense',
] as const;

export interface Payable {
    id: string;
    vendorName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    status: InvoiceStatus;
    paidAmount: number;
    description?: string;
    accountId?: string;
    createdAt: string;
}

export interface Receivable {
    id: string;
    customerName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    status: InvoiceStatus;
    paidAmount: number;
    description?: string;
    accountId?: string;
    createdAt: string;
}

// ── Seed: Chart of Accounts (QuickBooks-style) ──
const initialAccounts: Account[] = [
    // ═══ ASSETS (1xxx) ═══
    // — Bank —
    { id: 'acc-1000', code: '1000', name: 'Petty Cash', type: 'ASSET', detailType: 'Bank', balance: 12000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1010', code: '1010', name: 'Cash on Hand', type: 'ASSET', detailType: 'Bank', balance: 125000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1020', code: '1020', name: 'Checking Account – Emirates NBD', type: 'ASSET', detailType: 'Bank', balance: 450000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1030', code: '1030', name: 'Savings Account – ADCB', type: 'ASSET', detailType: 'Bank', balance: 280000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Accounts Receivable —
    { id: 'acc-1100', code: '1100', name: 'Accounts Receivable', type: 'ASSET', detailType: 'Accounts Receivable (A/R)', balance: 85000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1110', code: '1110', name: 'Insurance Claims Receivable', type: 'ASSET', detailType: 'Accounts Receivable (A/R)', balance: 57000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Other Current Assets —
    { id: 'acc-1200', code: '1200', name: 'Prepaid Rent', type: 'ASSET', detailType: 'Other Current Assets', balance: 30000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1210', code: '1210', name: 'Prepaid Insurance', type: 'ASSET', detailType: 'Other Current Assets', balance: 18000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1220', code: '1220', name: 'Inventory – Medicines', type: 'ASSET', detailType: 'Other Current Assets', balance: 95000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1230', code: '1230', name: 'Inventory – Consumables', type: 'ASSET', detailType: 'Other Current Assets', balance: 35000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1240', code: '1240', name: 'Inventory – Skincare Products', type: 'ASSET', detailType: 'Other Current Assets', balance: 22000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1250', code: '1250', name: 'Undeposited Funds', type: 'ASSET', detailType: 'Other Current Assets', balance: 8500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1260', code: '1260', name: 'Employee Advances', type: 'ASSET', detailType: 'Other Current Assets', balance: 5000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Fixed Assets —
    { id: 'acc-1500', code: '1500', name: 'Medical Equipment', type: 'ASSET', detailType: 'Fixed Assets', balance: 750000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1510', code: '1510', name: 'Laser Machines', type: 'ASSET', detailType: 'Fixed Assets', balance: 380000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1520', code: '1520', name: 'Furniture & Fixtures', type: 'ASSET', detailType: 'Fixed Assets', balance: 120000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1530', code: '1530', name: 'Computers & IT Equipment', type: 'ASSET', detailType: 'Fixed Assets', balance: 45000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1540', code: '1540', name: 'Leasehold Improvements', type: 'ASSET', detailType: 'Fixed Assets', balance: 220000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1550', code: '1550', name: 'Accumulated Depreciation', type: 'ASSET', detailType: 'Fixed Assets', balance: -185000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Other Assets —
    { id: 'acc-1800', code: '1800', name: 'Security Deposits', type: 'ASSET', detailType: 'Other Assets', balance: 60000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-1810', code: '1810', name: 'DHA License & Intangibles', type: 'ASSET', detailType: 'Other Assets', balance: 25000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },

    // ═══ LIABILITIES (2xxx) ═══
    // — Accounts Payable —
    { id: 'acc-2000', code: '2000', name: 'Accounts Payable', type: 'LIABILITY', detailType: 'Accounts Payable (A/P)', balance: 65000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Credit Card —
    { id: 'acc-2050', code: '2050', name: 'Company Credit Card', type: 'LIABILITY', detailType: 'Credit Card', balance: 12000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Other Current Liabilities —
    { id: 'acc-2100', code: '2100', name: 'VAT Payable', type: 'LIABILITY', detailType: 'Other Current Liabilities', balance: 18500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-2110', code: '2110', name: 'Salaries & Wages Payable', type: 'LIABILITY', detailType: 'Other Current Liabilities', balance: 0, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-2120', code: '2120', name: 'Gratuity Payable', type: 'LIABILITY', detailType: 'Other Current Liabilities', balance: 42000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-2130', code: '2130', name: 'Accrued Expenses', type: 'LIABILITY', detailType: 'Other Current Liabilities', balance: 15000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-2140', code: '2140', name: 'Unearned Revenue (Gift Cards / Packages)', type: 'LIABILITY', detailType: 'Other Current Liabilities', balance: 28000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Long-Term Liabilities —
    { id: 'acc-2500', code: '2500', name: 'Bank Loan – Equipment Finance', type: 'LIABILITY', detailType: 'Long-Term Liabilities', balance: 200000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-2510', code: '2510', name: 'Long-Term Lease Obligations', type: 'LIABILITY', detailType: 'Long-Term Liabilities', balance: 150000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },

    // ═══ EQUITY (3xxx) ═══
    { id: 'acc-3000', code: '3000', name: 'Owner\'s Equity / Capital', type: 'EQUITY', detailType: 'Owner\'s Equity', balance: 1500000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-3010', code: '3010', name: 'Owner\'s Draw', type: 'EQUITY', detailType: 'Owner\'s Equity', balance: 0, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-3100', code: '3100', name: 'Retained Earnings', type: 'EQUITY', detailType: 'Retained Earnings', balance: 350000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-3200', code: '3200', name: 'Opening Balance Equity', type: 'EQUITY', detailType: 'Owner\'s Equity', balance: 0, isActive: true, createdAt: '2025-01-01T00:00:00Z' },

    // ═══ INCOME / REVENUE (4xxx) ═══
    // — Service Income —
    { id: 'acc-4000', code: '4000', name: 'Consultation Revenue', type: 'REVENUE', detailType: 'Service Income', balance: 180000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4010', code: '4010', name: 'Treatment Revenue', type: 'REVENUE', detailType: 'Service Income', balance: 320000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4020', code: '4020', name: 'Laser Treatment Revenue', type: 'REVENUE', detailType: 'Service Income', balance: 250000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4030', code: '4030', name: 'Aesthetic Procedure Revenue', type: 'REVENUE', detailType: 'Service Income', balance: 145000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4040', code: '4040', name: 'Package Revenue', type: 'REVENUE', detailType: 'Service Income', balance: 95000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Sales of Product Income —
    { id: 'acc-4100', code: '4100', name: 'Skincare Product Sales', type: 'REVENUE', detailType: 'Sales of Product Income', balance: 45000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4110', code: '4110', name: 'Pharmaceutical Sales', type: 'REVENUE', detailType: 'Sales of Product Income', balance: 18000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Other Income —
    { id: 'acc-4500', code: '4500', name: 'Interest Income', type: 'REVENUE', detailType: 'Other Income', balance: 2500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-4510', code: '4510', name: 'Late Fee Income', type: 'REVENUE', detailType: 'Other Income', balance: 1200, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Discount Given —
    { id: 'acc-4900', code: '4900', name: 'Discounts Given', type: 'REVENUE', detailType: 'Discount Given', balance: -8500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },

    // ═══ COST OF GOODS SOLD (5xxx) ═══
    { id: 'acc-5000', code: '5000', name: 'Cost of Medicines Sold', type: 'COST_OF_GOODS_SOLD', detailType: 'Cost of Sales – Products', balance: 42000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-5010', code: '5010', name: 'Cost of Consumables Used', type: 'COST_OF_GOODS_SOLD', detailType: 'Cost of Sales – Services', balance: 22000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-5020', code: '5020', name: 'Cost of Skincare Products Sold', type: 'COST_OF_GOODS_SOLD', detailType: 'Cost of Sales – Products', balance: 18000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },

    // ═══ EXPENSES (6xxx) ═══
    // — Payroll Expenses —
    { id: 'acc-6000', code: '6000', name: 'Salaries & Wages', type: 'EXPENSE', detailType: 'Payroll Expenses', balance: 280000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6010', code: '6010', name: 'Employee Benefits', type: 'EXPENSE', detailType: 'Payroll Expenses', balance: 35000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6020', code: '6020', name: 'Staff Medical Insurance', type: 'EXPENSE', detailType: 'Payroll Expenses', balance: 24000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6030', code: '6030', name: 'Visa & Labour Card Costs', type: 'EXPENSE', detailType: 'Payroll Expenses', balance: 15000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Rent or Lease —
    { id: 'acc-6100', code: '6100', name: 'Clinic Rent – Al Muraqabat', type: 'EXPENSE', detailType: 'Rent or Lease', balance: 90000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6110', code: '6110', name: 'Clinic Rent – Al Qiyadah', type: 'EXPENSE', detailType: 'Rent or Lease', balance: 60000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6120', code: '6120', name: 'Clinic Rent – Silicon Oasis', type: 'EXPENSE', detailType: 'Rent or Lease', balance: 55000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Utilities —
    { id: 'acc-6200', code: '6200', name: 'DEWA (Electricity & Water)', type: 'EXPENSE', detailType: 'Utilities', balance: 22000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6210', code: '6210', name: 'Telephone & Internet', type: 'EXPENSE', detailType: 'Utilities', balance: 6000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Insurance —
    { id: 'acc-6300', code: '6300', name: 'Malpractice Insurance', type: 'EXPENSE', detailType: 'Insurance', balance: 24000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6310', code: '6310', name: 'General Liability Insurance', type: 'EXPENSE', detailType: 'Insurance', balance: 12000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Advertising & Marketing —
    { id: 'acc-6400', code: '6400', name: 'Google Ads & Digital Marketing', type: 'EXPENSE', detailType: 'Advertising & Marketing', balance: 28000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6410', code: '6410', name: 'Social Media Marketing', type: 'EXPENSE', detailType: 'Advertising & Marketing', balance: 12000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6420', code: '6420', name: 'Printing & Signage', type: 'EXPENSE', detailType: 'Advertising & Marketing', balance: 5000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Supplies —
    { id: 'acc-6500', code: '6500', name: 'Medical Supplies', type: 'EXPENSE', detailType: 'Supplies', balance: 65000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6510', code: '6510', name: 'Office Supplies', type: 'EXPENSE', detailType: 'Supplies', balance: 4500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6520', code: '6520', name: 'Cleaning Supplies', type: 'EXPENSE', detailType: 'Supplies', balance: 3200, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Repair & Maintenance —
    { id: 'acc-6600', code: '6600', name: 'Equipment Maintenance', type: 'EXPENSE', detailType: 'Repair & Maintenance', balance: 12000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6610', code: '6610', name: 'Building Maintenance', type: 'EXPENSE', detailType: 'Repair & Maintenance', balance: 6000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Legal & Professional Fees —
    { id: 'acc-6700', code: '6700', name: 'Accounting & Audit Fees', type: 'EXPENSE', detailType: 'Legal & Professional Fees', balance: 15000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6710', code: '6710', name: 'Legal Fees', type: 'EXPENSE', detailType: 'Legal & Professional Fees', balance: 8000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6720', code: '6720', name: 'DHA & Regulatory Fees', type: 'EXPENSE', detailType: 'Legal & Professional Fees', balance: 10000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Dues & Subscriptions —
    { id: 'acc-6800', code: '6800', name: 'Software Subscriptions', type: 'EXPENSE', detailType: 'Dues & Subscriptions', balance: 9600, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6810', code: '6810', name: 'Professional Memberships', type: 'EXPENSE', detailType: 'Dues & Subscriptions', balance: 3000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Depreciation —
    { id: 'acc-6900', code: '6900', name: 'Depreciation Expense', type: 'EXPENSE', detailType: 'Depreciation', balance: 42000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Bank Charges —
    { id: 'acc-6950', code: '6950', name: 'Bank Service Charges', type: 'EXPENSE', detailType: 'Bank Charges & Fees', balance: 3600, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'acc-6960', code: '6960', name: 'Credit Card Processing Fees', type: 'EXPENSE', detailType: 'Bank Charges & Fees', balance: 8400, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Interest Paid —
    { id: 'acc-6970', code: '6970', name: 'Loan Interest', type: 'EXPENSE', detailType: 'Interest Paid', balance: 6000, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    // — Other Business Expenses —
    { id: 'acc-6990', code: '6990', name: 'Miscellaneous Expense', type: 'EXPENSE', detailType: 'Other Business Expenses', balance: 8500, isActive: true, createdAt: '2025-01-01T00:00:00Z' },
];

// ── Seed: Transactions ──
const initialTransactions: Transaction[] = [
    { id: 'txn-001', date: '2026-02-01', type: 'INCOME', description: 'Consultation fees collected', reference: 'INV-2026-101', accountId: 'acc-4000', amount: 15000, paymentMethod: 'CARD', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', category: 'Services', createdAt: '2026-02-01T10:00:00Z' },
    { id: 'txn-002', date: '2026-02-03', type: 'INCOME', description: 'Laser treatment revenue', reference: 'INV-2026-102', accountId: 'acc-4020', amount: 24500, paymentMethod: 'CASH', branchId: 'clinic-2', branchName: 'Al Qiyadah Branch', category: 'Services', createdAt: '2026-02-03T11:00:00Z' },
    { id: 'txn-003', date: '2026-02-05', type: 'EXPENSE', description: 'Monthly rent - Al Muraqabat', reference: 'CHQ-5001', accountId: 'acc-5100', amount: 15000, paymentMethod: 'CHEQUE', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', category: 'Rent', createdAt: '2026-02-05T09:00:00Z' },
    { id: 'txn-004', date: '2026-02-07', type: 'EXPENSE', description: 'Medical supplies purchase', reference: 'PO-2026-015', accountId: 'acc-5200', amount: 8500, paymentMethod: 'BANK_TRANSFER', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', category: 'Supplies', createdAt: '2026-02-07T14:00:00Z' },
    { id: 'txn-005', date: '2026-02-10', type: 'INCOME', description: 'Package sales - 6 session bundle', reference: 'INV-2026-105', accountId: 'acc-4200', amount: 12000, paymentMethod: 'CARD', branchId: 'clinic-3', branchName: 'Silicon Oasis Branch', category: 'Packages', createdAt: '2026-02-10T16:00:00Z' },
    { id: 'txn-006', date: '2026-02-12', type: 'EXPENSE', description: 'DEWA utilities Feb', reference: 'UTIL-FEB-26', accountId: 'acc-5110', amount: 3200, paymentMethod: 'BANK_TRANSFER', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', category: 'Utilities', createdAt: '2026-02-12T08:00:00Z' },
    { id: 'txn-007', date: '2026-02-14', type: 'INCOME', description: 'RF Microneedling treatments', reference: 'INV-2026-108', accountId: 'acc-4010', amount: 18000, paymentMethod: 'CASH', branchId: 'clinic-1', branchName: 'Al Muraqabat Branch', category: 'Services', createdAt: '2026-02-14T13:00:00Z' },
    { id: 'txn-008', date: '2026-02-16', type: 'EXPENSE', description: 'Staff salary - Feb partial', reference: 'SAL-FEB-26', accountId: 'acc-5000', amount: 45000, paymentMethod: 'BANK_TRANSFER', category: 'Salaries', createdAt: '2026-02-16T10:00:00Z' },
    { id: 'txn-009', date: '2026-02-18', type: 'INCOME', description: 'Product sales - skincare range', reference: 'INV-2026-115', accountId: 'acc-4100', amount: 6500, paymentMethod: 'CARD', branchId: 'clinic-2', branchName: 'Al Qiyadah Branch', category: 'Products', createdAt: '2026-02-18T15:00:00Z' },
    { id: 'txn-010', date: '2026-02-20', type: 'EXPENSE', description: 'Google Ads campaign', reference: 'MKT-FEB-26', accountId: 'acc-5300', amount: 5000, paymentMethod: 'CARD', category: 'Marketing', createdAt: '2026-02-20T09:00:00Z' },
    { id: 'txn-011', date: '2026-02-22', type: 'INCOME', description: 'Consultation & follow-ups', reference: 'INV-2026-120', accountId: 'acc-4000', amount: 9800, paymentMethod: 'CASH', branchId: 'clinic-3', branchName: 'Silicon Oasis Branch', category: 'Services', createdAt: '2026-02-22T11:00:00Z' },
    { id: 'txn-012', date: '2026-02-24', type: 'EXPENSE', description: 'Equipment maintenance', reference: 'MNT-2026-003', accountId: 'acc-6600', amount: 2800, paymentMethod: 'CASH', branchId: 'clinic-2', branchName: 'Al Qiyadah Branch', category: 'Maintenance', createdAt: '2026-02-24T14:00:00Z' },
    // ── Employee-linked Expenses ──
    { id: 'txn-013', date: '2026-01-15', type: 'EXPENSE', description: 'Employment visa processing', reference: 'VISA-2026-001', accountId: 'acc-6030', amount: 3500, paymentMethod: 'BANK_TRANSFER', category: 'Visa Processing', employeeId: 'emp-002', employeeName: 'Fatima Hassan', createdAt: '2026-01-15T09:00:00Z' },
    { id: 'txn-014', date: '2026-01-20', type: 'EXPENSE', description: 'DHA license renewal', reference: 'DHA-2026-002', accountId: 'acc-6720', amount: 2500, paymentMethod: 'BANK_TRANSFER', category: 'DHA License', employeeId: 'emp-001', employeeName: 'Ahmed Al Mansouri', createdAt: '2026-01-20T10:00:00Z' },
    { id: 'txn-015', date: '2026-01-25', type: 'EXPENSE', description: 'Medical insurance premium – Q1', reference: 'INS-2026-Q1-001', accountId: 'acc-6020', amount: 4200, paymentMethod: 'BANK_TRANSFER', category: 'Medical Insurance', employeeId: 'emp-001', employeeName: 'Ahmed Al Mansouri', createdAt: '2026-01-25T11:00:00Z' },
    { id: 'txn-016', date: '2026-02-02', type: 'EXPENSE', description: 'Medical insurance premium – Q1', reference: 'INS-2026-Q1-002', accountId: 'acc-6020', amount: 3800, paymentMethod: 'BANK_TRANSFER', category: 'Medical Insurance', employeeId: 'emp-002', employeeName: 'Fatima Hassan', createdAt: '2026-02-02T09:00:00Z' },
    { id: 'txn-017', date: '2026-02-05', type: 'EXPENSE', description: 'Flight ticket – joining', reference: 'FLT-2026-001', accountId: 'acc-6030', amount: 2200, paymentMethod: 'CARD', category: 'Flight Ticket', employeeId: 'emp-003', employeeName: 'Ravi Kumar', createdAt: '2026-02-05T14:00:00Z' },
    { id: 'txn-018', date: '2026-02-10', type: 'EXPENSE', description: 'Laser training course', reference: 'TRN-2026-003', accountId: 'acc-6010', amount: 5000, paymentMethod: 'BANK_TRANSFER', category: 'Training', employeeId: 'emp-002', employeeName: 'Fatima Hassan', createdAt: '2026-02-10T10:00:00Z' },
    { id: 'txn-019', date: '2026-02-15', type: 'EXPENSE', description: 'Labour card renewal', reference: 'LC-2026-001', accountId: 'acc-6030', amount: 1800, paymentMethod: 'BANK_TRANSFER', category: 'Labour Card', employeeId: 'emp-003', employeeName: 'Ravi Kumar', createdAt: '2026-02-15T11:00:00Z' },
    { id: 'txn-020', date: '2026-02-18', type: 'EXPENSE', description: 'Medical insurance premium – Q1', reference: 'INS-2026-Q1-003', accountId: 'acc-6020', amount: 3200, paymentMethod: 'BANK_TRANSFER', category: 'Medical Insurance', employeeId: 'emp-003', employeeName: 'Ravi Kumar', createdAt: '2026-02-18T09:00:00Z' },
];

// ── Seed: Payables & Receivables ──
const initialPayables: Payable[] = [
    { id: 'pay-001', vendorName: 'DUBEMED TR LLC', invoiceNumber: 'DM-INV-2026-045', amount: 12500, dueDate: '2026-03-15', status: 'SENT', paidAmount: 0, description: 'Medical supplies order', accountId: 'acc-2000', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'pay-002', vendorName: 'Al Muraqabat Landlord', invoiceNumber: 'RENT-MAR-26', amount: 15000, dueDate: '2026-03-01', status: 'SENT', paidAmount: 0, description: 'Monthly rent - March', accountId: 'acc-2000', createdAt: '2026-02-20T00:00:00Z' },
    { id: 'pay-003', vendorName: 'LIFECARE MEDICAL', invoiceNumber: 'LC-2026-018', amount: 8000, dueDate: '2026-02-28', status: 'OVERDUE', paidAmount: 0, description: 'Laser machine calibration', accountId: 'acc-2000', createdAt: '2026-01-28T00:00:00Z' },
    { id: 'pay-004', vendorName: 'PROCKIMA DRUG STORE', invoiceNumber: 'PDS-2026-009', amount: 4500, dueDate: '2026-03-10', status: 'PARTIALLY_PAID', paidAmount: 2000, description: 'Consumables order', accountId: 'acc-2000', createdAt: '2026-02-10T00:00:00Z' },
];

const initialReceivables: Receivable[] = [
    { id: 'rec-001', customerName: 'Insurance Co. - AXA', invoiceNumber: 'REC-2026-001', amount: 35000, dueDate: '2026-03-20', status: 'SENT', paidAmount: 0, description: 'Insurance claim batch - Jan', accountId: 'acc-1100', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'rec-002', customerName: 'Corporate Client - ENOC', invoiceNumber: 'REC-2026-005', amount: 18000, dueDate: '2026-03-05', status: 'PARTIALLY_PAID', paidAmount: 10000, description: 'Employee health checkup package', accountId: 'acc-1100', createdAt: '2026-02-05T00:00:00Z' },
    { id: 'rec-003', customerName: 'Insurance Co. - Daman', invoiceNumber: 'REC-2026-008', amount: 22000, dueDate: '2026-03-25', status: 'SENT', paidAmount: 0, description: 'Insurance claim batch - Feb', accountId: 'acc-1100', createdAt: '2026-02-15T00:00:00Z' },
];

// ── In-memory stores ──
let accounts: Account[] = JSON.parse(JSON.stringify(initialAccounts));
let transactions: Transaction[] = JSON.parse(JSON.stringify(initialTransactions));
let payables: Payable[] = JSON.parse(JSON.stringify(initialPayables));
let receivables: Receivable[] = JSON.parse(JSON.stringify(initialReceivables));
interface AccountingData { accounts: Account[]; transactions: Transaction[]; payables: Payable[]; receivables: Receivable[]; }

async function ensureAcctLoaded() {
    
        const data = await loadFromBlob<AccountingData>('accounting', { accounts: initialAccounts, transactions: initialTransactions, payables: initialPayables, receivables: initialReceivables });
        accounts = data.accounts;
        transactions = data.transactions;
        payables = data.payables;
        receivables = data.receivables;
        
}

async function saveAccounting() {
    await saveToBlob('accounting', { accounts, transactions, payables, receivables });
}

export const AccountingStore = {
    // ─── Accounts ───
    getAllAccounts: async (filters?: { type?: AccountType; search?: string; active?: boolean }): Promise<Account[]> => {
        await ensureAcctLoaded();
        let result = [...accounts];
        if (filters?.type) result = result.filter(a => a.type === filters.type);
        if (filters?.active !== undefined) result = result.filter(a => a.isActive === filters.active);
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(a => a.name.toLowerCase().includes(q) || a.code.includes(q));
        }
        return result.sort((a, b) => a.code.localeCompare(b.code));
    },

    getAccountById: async (id: string): Promise<Account | undefined> => { await ensureAcctLoaded(); return accounts.find(a => a.id === id); },

    addAccount: async (data: Omit<Account, 'id' | 'createdAt'>): Promise<Account> => {
        await ensureAcctLoaded();
        const account: Account = { ...data, id: `acc-${Date.now()}`, createdAt: new Date().toISOString() };
        accounts.push(account);
        await saveAccounting();
        return account;
    },

    updateAccount: async (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account | null> => {
        await ensureAcctLoaded();
        const idx = accounts.findIndex(a => a.id === id);
        if (idx === -1) return null;
        accounts[idx] = { ...accounts[idx], ...updates };
        await saveAccounting();
        return accounts[idx];
    },

    deleteAccount: async (id: string): Promise<boolean> => {
        await ensureAcctLoaded();
        const len = accounts.length;
        accounts = accounts.filter(a => a.id !== id);
        if (accounts.length < len) { await saveAccounting(); return true; }
        return false;
    },

    // ─── Transactions ───
    getAllTransactions: async (filters?: { type?: TransactionType; accountId?: string; dateFrom?: string; dateTo?: string; search?: string; branchId?: string }): Promise<Transaction[]> => {
        await ensureAcctLoaded();
        let result = [...transactions];
        if (filters?.type) result = result.filter(t => t.type === filters.type);
        if (filters?.accountId) result = result.filter(t => t.accountId === filters.accountId || t.toAccountId === filters.accountId);
        if (filters?.branchId) result = result.filter(t => t.branchId === filters.branchId);
        if (filters?.dateFrom) result = result.filter(t => t.date >= filters.dateFrom!);
        if (filters?.dateTo) result = result.filter(t => t.date <= filters.dateTo!);
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(t => t.description.toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q));
        }
        return result.sort((a, b) => b.date.localeCompare(a.date));
    },

    addTransaction: async (data: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> => {
        await ensureAcctLoaded();
        const txn: Transaction = { ...data, id: `txn-${Date.now()}`, createdAt: new Date().toISOString() };
        transactions.push(txn);
        await saveAccounting();
        return txn;
    },

    updateTransaction: async (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<Transaction | null> => {
        await ensureAcctLoaded();
        const idx = transactions.findIndex(t => t.id === id);
        if (idx === -1) return null;
        transactions[idx] = { ...transactions[idx], ...updates };
        await saveAccounting();
        return transactions[idx];
    },

    deleteTransaction: async (id: string): Promise<boolean> => {
        await ensureAcctLoaded();
        const len = transactions.length;
        transactions = transactions.filter(t => t.id !== id);
        if (transactions.length < len) { await saveAccounting(); return true; }
        return false;
    },

    // ─── Payables ───
    getAllPayables: async (): Promise<Payable[]> => { await ensureAcctLoaded(); return [...payables].sort((a, b) => a.dueDate.localeCompare(b.dueDate)); },
    addPayable: async (data: Omit<Payable, 'id' | 'createdAt'>): Promise<Payable> => {
        await ensureAcctLoaded();
        const p: Payable = { ...data, id: `pay-${Date.now()}`, createdAt: new Date().toISOString() };
        payables.push(p);
        await saveAccounting();
        return p;
    },
    updatePayable: async (id: string, updates: Partial<Omit<Payable, 'id' | 'createdAt'>>): Promise<Payable | null> => {
        await ensureAcctLoaded();
        const idx = payables.findIndex(p => p.id === id);
        if (idx === -1) return null;
        payables[idx] = { ...payables[idx], ...updates };
        await saveAccounting();
        return payables[idx];
    },
    deletePayable: async (id: string): Promise<boolean> => { await ensureAcctLoaded(); const l = payables.length; payables = payables.filter(p => p.id !== id); if (payables.length < l) { await saveAccounting(); return true; } return false; },

    // ─── Receivables ───
    getAllReceivables: async (): Promise<Receivable[]> => { await ensureAcctLoaded(); return [...receivables].sort((a, b) => a.dueDate.localeCompare(b.dueDate)); },
    addReceivable: async (data: Omit<Receivable, 'id' | 'createdAt'>): Promise<Receivable> => {
        await ensureAcctLoaded();
        const r: Receivable = { ...data, id: `rec-${Date.now()}`, createdAt: new Date().toISOString() };
        receivables.push(r);
        await saveAccounting();
        return r;
    },
    updateReceivable: async (id: string, updates: Partial<Omit<Receivable, 'id' | 'createdAt'>>): Promise<Receivable | null> => {
        await ensureAcctLoaded();
        const idx = receivables.findIndex(r => r.id === id);
        if (idx === -1) return null;
        receivables[idx] = { ...receivables[idx], ...updates };
        await saveAccounting();
        return receivables[idx];
    },
    deleteReceivable: async (id: string): Promise<boolean> => { await ensureAcctLoaded(); const l = receivables.length; receivables = receivables.filter(r => r.id !== id); if (receivables.length < l) { await saveAccounting(); return true; } return false; },

    // ─── Reports ───
    getSummary: async () => {
        await ensureAcctLoaded();
        const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        const netProfit = totalIncome - totalExpense;
        const totalAssets = accounts.filter(a => a.type === 'ASSET').reduce((s, a) => s + a.balance, 0);
        const totalLiabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((s, a) => s + a.balance, 0);
        const totalEquity = accounts.filter(a => a.type === 'EQUITY').reduce((s, a) => s + a.balance, 0);
        const totalRevenue = accounts.filter(a => a.type === 'REVENUE').reduce((s, a) => s + a.balance, 0);
        const totalExpenses = accounts.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0);
        const totalPayable = payables.filter(p => p.status !== 'PAID' && p.status !== 'CANCELLED').reduce((s, p) => s + (p.amount - p.paidAmount), 0);
        const totalReceivable = receivables.filter(r => r.status !== 'PAID' && r.status !== 'CANCELLED').reduce((s, r) => s + (r.amount - r.paidAmount), 0);
        const overduePayables = payables.filter(p => p.status === 'OVERDUE').length;
        const overdueReceivables = receivables.filter(r => r.status === 'OVERDUE').length;
        return {
            totalIncome, totalExpense, netProfit,
            totalAssets, totalLiabilities, totalEquity,
            totalRevenue, totalExpenses,
            totalPayable, totalReceivable,
            overduePayables, overdueReceivables,
            transactionCount: transactions.length,
        };
    },

    getProfitLoss: async () => {
        await ensureAcctLoaded();
        const revenueAccounts = accounts.filter(a => a.type === 'REVENUE');
        const cogsAccounts = accounts.filter(a => a.type === 'COST_OF_GOODS_SOLD');
        const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE');
        const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0);
        const totalCOGS = cogsAccounts.reduce((s, a) => s + a.balance, 0);
        const grossProfit = totalRevenue - totalCOGS;
        const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0);
        return {
            revenue: revenueAccounts.map(a => ({ name: a.name, code: a.code, amount: a.balance, detailType: a.detailType })),
            cogs: cogsAccounts.map(a => ({ name: a.name, code: a.code, amount: a.balance, detailType: a.detailType })),
            expenses: expenseAccounts.map(a => ({ name: a.name, code: a.code, amount: a.balance, detailType: a.detailType })),
            totalRevenue,
            totalCOGS,
            grossProfit,
            totalExpenses,
            netIncome: grossProfit - totalExpenses,
        };
    },

    getBalanceSheet: async () => {
        await ensureAcctLoaded();
        const assetAccts = accounts.filter(a => a.type === 'ASSET');
        const liabilityAccts = accounts.filter(a => a.type === 'LIABILITY');
        const equityAccts = accounts.filter(a => a.type === 'EQUITY');
        return {
            assets: assetAccts.map(a => ({ name: a.name, code: a.code, amount: a.balance })),
            liabilities: liabilityAccts.map(a => ({ name: a.name, code: a.code, amount: a.balance })),
            equity: equityAccts.map(a => ({ name: a.name, code: a.code, amount: a.balance })),
            totalAssets: assetAccts.reduce((s, a) => s + a.balance, 0),
            totalLiabilities: liabilityAccts.reduce((s, a) => s + a.balance, 0),
            totalEquity: equityAccts.reduce((s, a) => s + a.balance, 0),
        };
    },

    // ─── Employee Expenses ───
    getEmployeeExpenses: async () => {
        await ensureAcctLoaded();
        const empTxns = transactions.filter(t => t.employeeId);
        const byEmployee: Record<string, { employeeId: string; employeeName: string; categories: Record<string, number>; total: number }> = {};
        empTxns.forEach(t => {
            if (!byEmployee[t.employeeId!]) {
                byEmployee[t.employeeId!] = { employeeId: t.employeeId!, employeeName: t.employeeName || t.employeeId!, categories: {}, total: 0 };
            }
            const cat = t.category || 'Other';
            byEmployee[t.employeeId!].categories[cat] = (byEmployee[t.employeeId!].categories[cat] || 0) + t.amount;
            byEmployee[t.employeeId!].total += t.amount;
        });
        return Object.values(byEmployee).sort((a, b) => b.total - a.total);
    },

    getExpensesByEmployee: async (employeeId: string) => {
        await ensureAcctLoaded();
        return transactions.filter(t => t.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date));
    },

    // ─── Branch-wise Summary ───
    getBranchSummary: async () => {
        await ensureAcctLoaded();
        const branches: Record<string, {
            branchId: string; branchName: string;
            totalIncome: number; totalExpense: number; netProfit: number;
            txnCount: number;
            incomeByCategory: Record<string, number>;
            expenseByCategory: Record<string, number>;
        }> = {};

        transactions.forEach(t => {
            const bid = t.branchId || 'head-office';
            const bname = t.branchName || 'Head Office';
            if (!branches[bid]) {
                branches[bid] = { branchId: bid, branchName: bname, totalIncome: 0, totalExpense: 0, netProfit: 0, txnCount: 0, incomeByCategory: {}, expenseByCategory: {} };
            }
            branches[bid].txnCount++;
            if (t.type === 'INCOME') {
                branches[bid].totalIncome += t.amount;
                const cat = t.category || 'Other';
                branches[bid].incomeByCategory[cat] = (branches[bid].incomeByCategory[cat] || 0) + t.amount;
            } else if (t.type === 'EXPENSE') {
                branches[bid].totalExpense += t.amount;
                const cat = t.category || 'Other';
                branches[bid].expenseByCategory[cat] = (branches[bid].expenseByCategory[cat] || 0) + t.amount;
            }
            branches[bid].netProfit = branches[bid].totalIncome - branches[bid].totalExpense;
        });

        return Object.values(branches).sort((a, b) => b.netProfit - a.netProfit);
    },
};
