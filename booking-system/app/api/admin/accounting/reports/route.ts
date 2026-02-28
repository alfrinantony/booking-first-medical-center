import { NextResponse } from 'next/server';
import { AccountingStore } from '@/lib/accounting-store';

export async function GET() {
    return NextResponse.json({
        summary: AccountingStore.getSummary(),
        profitLoss: AccountingStore.getProfitLoss(),
        balanceSheet: AccountingStore.getBalanceSheet(),
        employeeExpenses: AccountingStore.getEmployeeExpenses(),
        branchSummary: AccountingStore.getBranchSummary(),
    });
}
