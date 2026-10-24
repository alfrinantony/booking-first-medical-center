'use client';

import React from 'react';
import MembershipsManager from '@/components/admin/MembershipsManager';
import { Crown } from 'lucide-react';

export default function MembershipsPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Crown className="w-6 h-6" />
                    </div>
                    Membership Privileges
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage patient membership privileges, VIP club tiers, customizable pictures, duration, VAT, and procedure allowances.
                </p>
            </div>

            <MembershipsManager />
        </div>
    );
}
