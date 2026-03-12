'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/users-types';

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    const kickUser = useCallback(() => {
        sessionStorage.removeItem('adminUser');
        router.push('/admin/login?kicked=1');
    }, [router]);

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

    // ── Session polling: verify token is still valid every 15 seconds ──
    useEffect(() => {
        if (pathname === '/admin/login') return;

        const validateSession = async () => {
            const userStr = sessionStorage.getItem('adminUser');
            if (!userStr) return;

            try {
                const user: User = JSON.parse(userStr);
                if (!user?.id || !user?.sessionToken) return;

                const res = await fetch(
                    `/api/admin/session?userId=${encodeURIComponent(user.id)}&token=${encodeURIComponent(user.sessionToken)}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (!data.valid) {
                        kickUser();
                    }
                }
            } catch {
                // Network error — don't kick on transient failures
            }
        };

        // Validate immediately on mount, then every 15 seconds
        validateSession();
        const interval = setInterval(validateSession, 15000);

        return () => clearInterval(interval);
    }, [pathname, kickUser]);

    // Show nothing while checking (or a loading spinner)
    if (!authorized && pathname !== '/admin/login') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>;
    }

    return <>{children}</>;
}
