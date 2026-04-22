'use client';

import React from 'react';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import AdminSidebar from '@/components/AdminSidebar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/admin/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <AdminAuthGuard>
            <div className="h-screen bg-gray-100 dark:bg-gray-900 flex overflow-hidden">
                <AdminSidebar />
                <div className="flex-1 md:ml-60 transition-all duration-300 h-full overflow-auto">
                    {children}
                </div>
            </div>
        </AdminAuthGuard>
    );
}
