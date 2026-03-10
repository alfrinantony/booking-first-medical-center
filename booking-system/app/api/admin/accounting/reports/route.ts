import { NextResponse } from 'next/server';
import { AccountingStore } from '@/lib/accounting-store';

export async function GET() {
    return NextResponse.json({
        summary: await AccountingStore.getSummary(),
        profitLoss: await AccountingStore.getProfitLoss(),
        balanceSheet: await AccountingStore.getBalanceSheet(),
        employeeExpenses: await AccountingStore.getEmployeeExpenses(),
        branchSummary: await AccountingStore.getBranchSummary(),
    });
}
