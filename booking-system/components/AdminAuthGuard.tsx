'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/users-store';

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        // Skip check for login page
        if (pathname === '/admin/login') {
            setAuthorized(true);
            return;
        }

        const checkAuth = () => {
            const userStr = sessionStorage.getItem('adminUser');
            if (!userStr) {
                router.push('/admin/login');
                return;
            }

            try {
                const user: User = JSON.parse(userStr);
                if (!user || !user.role) {
                    throw new Error('Invalid user');
                }
                setAuthorized(true);
            } catch (e) {
                sessionStorage.removeItem('adminUser');
                router.push('/admin/login');
            }
        };

        checkAuth();
    }, [pathname, router]);

    // Show nothing while checking (or a loading spinner)
    if (!authorized && pathname !== '/admin/login') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>;
    }

    return <>{children}</>;
}
