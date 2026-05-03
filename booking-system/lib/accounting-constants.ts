export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COST_OF_GOODS_SOLD'] as const;

export const DETAIL_TYPES: Record<string, string[]> = {
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

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    REVENUE: 'Income',
    EXPENSE: 'Expenses',
    COST_OF_GOODS_SOLD: 'Cost of Goods Sold',
};

export const EMPLOYEE_EXPENSE_CATEGORIES = [
    'Basic Salary',
    'Housing Allowance',
    'Transportation Allowance',
    'Other Allowances',
    'Incentives / Commissions',
    'Overtime',
    'Visa / Immigration Costs',
    'Health Insurance',
    'Airfare / Tickets',
    'Training / Certification',
    'End of Service (Gratuity)',
    'Other Employee Costs'
] as const;
