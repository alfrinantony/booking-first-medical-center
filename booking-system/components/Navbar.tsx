'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, User, LayoutDashboard, Settings, LogIn } from 'lucide-react'; // Added LogIn
import { useAuthStore } from '@/lib/store'; // Import auth store

export default function Navbar() {
    const pathname = usePathname();
    const { isAuthenticated, user } = useAuthStore(); // Access auth state

    const isActive = (path: string) => pathname === path;

    const navItems = [
        { name: 'Home', path: '/', icon: Home },
        { name: 'Book Now', path: '/booking', icon: LayoutDashboard },
        { name: 'Packages', path: '/packages', icon: Package },
    ];

    // Don't show public navbar on admin pages
    if (pathname.startsWith('/admin')) return null;

    return (
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/" className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                                BookingFirst
                            </Link>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${isActive(item.path)
                                            ? 'border-indigo-500 text-gray-900 dark:text-white'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                >
                                    <item.icon className="w-4 h-4 mr-2" />
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isAuthenticated && user ? (
                            <Link
                                href="/customer/dashboard"
                                className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${isActive('/customer/dashboard')
                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                                    {user.name.charAt(0)}
                                </div>
                                <span className="hidden sm:inline">My Dashboard</span>
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <LogIn className="w-4 h-4" />
                                Login / Register
                            </Link>
                        )}

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block"></div>

                        <Link
                            href="/admin/login"
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-2 rounded-md"
                            title="Staff Login"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Mobile Menu (Simple) */}
            <div className="sm:hidden flex justify-around border-t border-gray-100 dark:border-gray-800 py-2">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`flex flex-col items-center p-2 text-xs ${isActive(item.path)
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        <item.icon className="w-5 h-5 mb-1" />
                        {item.name}
                    </Link>
                ))}
                {isAuthenticated ? (
                    <Link
                        href="/customer/dashboard"
                        className={`flex flex-col items-center p-2 text-xs ${isActive('/customer/dashboard')
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        <User className="w-5 h-5 mb-1" />
                        My Dashboard
                    </Link>
                ) : (
                    <Link
                        href="/login"
                        className="flex flex-col items-center p-2 text-xs text-gray-500 dark:text-gray-400"
                    >
                        <LogIn className="w-5 h-5 mb-1" />
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}
