import { redirect } from 'next/navigation';

export default function TransactionsReportRedirect() {
    redirect('/admin/reports'); // Eventually point to specific tab
}
