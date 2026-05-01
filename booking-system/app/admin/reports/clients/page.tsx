import { redirect } from 'next/navigation';

export default function ClientsReportRedirect() {
    redirect('/admin/reports'); // Eventually point to specific tab
}
