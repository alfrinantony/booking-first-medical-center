import { redirect } from 'next/navigation';

export default function PackagesReportRedirect() {
    redirect('/admin/reports'); // Eventually point to specific tab
}
