import { redirect } from 'next/navigation';

export default function BookingsReportRedirect() {
    redirect('/admin/reports'); // Eventually point to specific tab
}
