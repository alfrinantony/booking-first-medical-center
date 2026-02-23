'use client';

import CustomerAuth from "@/components/auth/CustomerAuth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/customer/dashboard');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md mb-8 text-center">
                <h1 className="text-3xl font-bold text-indigo-600 mb-2">Booking First Medical Center</h1>
                <p className="text-gray-500 dark:text-gray-400">Please sign in or register to manage your account</p>
            </div>
            <CustomerAuth onSuccess={handleSuccess} />
        </div>
    );
}
