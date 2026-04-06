'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { Eye, EyeOff, User, Mail, Phone, Lock, Calendar, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';

interface CustomerAuthProps {
    onSuccess?: () => void;
}

export default function CustomerAuth({ onSuccess }: CustomerAuthProps) {
    const [mode, setMode] = useState<
        'login' | 'register' | 'register-verify' |
        'forgot-email' | 'forgot-otp' | 'forgot-newpw'
    >('login');
    const { login: setGlobalUser } = useAuthStore();

    // Login state
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Register state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'' | 'male' | 'female'>('');

    // OTP state
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [devCode, setDevCode] = useState<string | null>(null); // for dev mode display
    const [codeHash, setCodeHash] = useState<string | null>(null); // hash from server for client-side verification

    // Forgot password state
    const [forgotEmail, setForgotEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Registration email for verification
    const [pendingEmail, setPendingEmail] = useState('');

    // Feedback
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    /* ────────── HELPERS ────────── */

    const resetState = () => {
        setError(null);
        setSuccessMsg(null);
        setOtpCode('');
        setDevCode(null);
        setOtpLoading(false);
    };

    /**
     * Hash function matching the server's implementation.
     * Used to verify OTP codes client-side (necessary because Azure SWA's
     * serverless functions don't persist in-memory state between calls).
     */
    const hashOtpCode = (code: string, email: string): string => {
        const salt = 'fmc-otp-2024';
        const raw = `${salt}:${email.toLowerCase()}:${code}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const ch = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    };

    const sendOtp = async (targetEmail: string, purpose: 'registration' | 'password-reset') => {
        setOtpLoading(true);
        setError(null);
        setDevCode(null);
        setCodeHash(null);
        try {
            const res = await fetch('/api/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail, purpose }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to send verification code');
                setOtpLoading(false);
                return false;
            }
            if (data.devMode && data.code) {
                setDevCode(data.code);
            }
            if (data.codeHash) {
                setCodeHash(data.codeHash);
            }
            setOtpLoading(false);
            return true;
        } catch {
            setError('Network error. Please try again.');
            setOtpLoading(false);
            return false;
        }
    };

    /**
     * Verify OTP client-side by comparing the hash.
     * This replaces the old server-side verification which broke on Azure
     * because serverless functions don't share in-memory state.
     */
    const verifyOtp = async (targetEmail: string, code: string, _purpose: 'registration' | 'password-reset') => {
        setOtpLoading(true);
        setError(null);

        if (!codeHash) {
            setError('No verification code was sent. Please request a new code.');
            setOtpLoading(false);
            return false;
        }

        const inputHash = hashOtpCode(code, targetEmail);
        if (inputHash !== codeHash) {
            setError('Invalid or expired verification code.');
            setOtpLoading(false);
            return false;
        }

        // Code matches — clear hash to prevent reuse
        setCodeHash(null);
        setOtpLoading(false);
        return true;
    };

    /* ────────── HANDLERS ────────── */

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setOtpLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }),
            });
            const result = await res.json();
            if (res.ok && result.success && result.user) {
                setGlobalUser(result.user);
                if (onSuccess) onSuccess();
            } else {
                setError(result.message || 'Login failed.');
            }
        } catch (err) {
            setError('Network error during login.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setOtpLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password, dateOfBirth: dob, gender })
            });
            const result = await res.json();
            
            if (!res.ok || !result.success) {
                setError(result.message || 'Registration failed.');
                setOtpLoading(false);
                return;
            }

            // Account created (unverified) — send OTP
            setPendingEmail(email);
            const sent = await sendOtp(email, 'registration');
            if (sent) {
                setSuccessMsg('Account created! Please check your email for the verification code.');
                setMode('register-verify');
            }
        } catch (err) {
            setError('Network error during registration.');
            setOtpLoading(false);
        }
    };

    const handleVerifyRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        const valid = await verifyOtp(pendingEmail, otpCode, 'registration');
        if (!valid) return;

        // Mark as verified
        try {
            await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail })
            });
            
            // Auto-login
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: pendingEmail, password }),
            });
            const result = await res.json();
            if (res.ok && result.success && result.user) {
                setSuccessMsg('Email verified! Logging you in...');
                setTimeout(() => {
                    setGlobalUser(result.user!);
                    if (onSuccess) onSuccess();
                }, 1000);
            } else {
                setError(result.message || 'Failed to auto-login. Please login manually.');
                setMode('login');
            }
        } catch (err) {
            setError('Error verifying email. Try refreshing the page.');
        }
    };

    const handleForgotSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const sent = await sendOtp(forgotEmail, 'password-reset');
        if (sent) {
            setSuccessMsg('Verification code sent to your email.');
            setMode('forgot-otp');
        }
    };

    const handleForgotVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const valid = await verifyOtp(forgotEmail, otpCode, 'password-reset');
        if (!valid) return;

        setSuccessMsg('Code verified! Now set your new password.');
        setOtpCode('');
        setDevCode(null);
        setMode('forgot-newpw');
    };

    const handleForgotResetPw = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setOtpLoading(true);

        if (newPassword.length < 4) {
            setError('Password must be at least 4 characters.');
            setOtpLoading(false);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            setOtpLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: forgotEmail, newPassword })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                setSuccessMsg(result.message || 'Password reset successfully.');
                setTimeout(() => {
                    resetState();
                    setMode('login');
                }, 2000);
            } else {
                setError(result.message || 'Error occurred while resetting password.');
            }
        } catch (err) {
            setError('Network connection error.');
        } finally {
            setOtpLoading(false);
        }
    };

    /* ────────── SHARED COMPONENTS ────────── */

    const DevCodeBanner = () => devCode ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm p-3 rounded-lg mb-4">
            <strong>Dev Mode</strong> — SMTP not configured. Your code is: <code className="bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded font-bold text-lg tracking-widest">{devCode}</code>
        </div>
    ) : null;

    const OtpInput = () => (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
            <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    required
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 text-center text-lg tracking-[0.5em] font-mono"
                    placeholder="000000"
                    autoFocus
                />
            </div>
        </div>
    );

    const BackToLogin = () => (
        <button
            type="button"
            onClick={() => { resetState(); setMode('login'); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2"
        >
            <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>
    );

    const SubmitButton = ({ children, loading }: { children: React.ReactNode; loading?: boolean }) => (
        <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );

    const PasswordInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
        <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                required
                type={showPassword ? "text" : "password"}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                placeholder={placeholder}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );

    /* ────────── Active tab logic ────────── */
    const isLoginTab = ['login', 'forgot-email', 'forgot-otp', 'forgot-newpw'].includes(mode);
    const isRegisterTab = ['register', 'register-verify'].includes(mode);

    /* ────────── RENDER ────────── */

    return (
        <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Tab Bar */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => { resetState(); setMode('login'); }}
                    className={`flex-1 py-4 text-sm font-medium transition-colors ${isLoginTab
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Log In
                </button>
                <button
                    onClick={() => { resetState(); setMode('register'); }}
                    className={`flex-1 py-4 text-sm font-medium transition-colors ${isRegisterTab
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Register
                </button>
            </div>

            <div className="p-6">
                {/* Feedback banners */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-600 text-sm p-3 rounded-lg mb-4">
                        {successMsg}
                    </div>
                )}

                {/* ═════════ LOGIN ═════════ */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email or Phone</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter email or phone"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <PasswordInput value={password} onChange={setPassword} placeholder="Enter password" />
                        </div>
                        <SubmitButton>Log In</SubmitButton>
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => { resetState(); setMode('forgot-email'); }}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    </form>
                )}

                {/* ═════════ FORGOT · STEP 1 · Enter email ═════════ */}
                {mode === 'forgot-email' && (
                    <form onSubmit={handleForgotSendCode} className="space-y-4">
                        <BackToLogin />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Password</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enter the email address associated with your account. We&apos;ll send you a verification code.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type="email"
                                    value={forgotEmail}
                                    onChange={e => setForgotEmail(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>
                        <SubmitButton loading={otpLoading}>Send Verification Code</SubmitButton>
                    </form>
                )}

                {/* ═════════ FORGOT · STEP 2 · Enter OTP ═════════ */}
                {mode === 'forgot-otp' && (
                    <form onSubmit={handleForgotVerifyCode} className="space-y-4">
                        <BackToLogin />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enter Verification Code</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">We sent a 6-digit code to <strong>{forgotEmail}</strong>. Enter it below.</p>
                        <DevCodeBanner />
                        <OtpInput />
                        <SubmitButton loading={otpLoading}>Verify Code</SubmitButton>
                        <div className="text-center">
                            <button type="button" onClick={() => sendOtp(forgotEmail, 'password-reset')} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                Resend Code
                            </button>
                        </div>
                    </form>
                )}

                {/* ═════════ FORGOT · STEP 3 · Set new password ═════════ */}
                {mode === 'forgot-newpw' && (
                    <form onSubmit={handleForgotResetPw} className="space-y-4">
                        <BackToLogin />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Set New Password</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Create a new password for your account.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                            <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New password" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                        <SubmitButton>Reset Password</SubmitButton>
                    </form>
                )}

                {/* ═════════ REGISTER ═════════ */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    required
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="+971 50 123 4567"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        required
                                        type="date"
                                        value={dob}
                                        onChange={e => setDob(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                                <select
                                    required
                                    value={gender}
                                    onChange={e => setGender(e.target.value as '' | 'male' | 'female')}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="" disabled>Please select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <PasswordInput value={password} onChange={setPassword} placeholder="Create a password" />
                        </div>
                        <SubmitButton loading={otpLoading}>Create Account</SubmitButton>
                    </form>
                )}

                {/* ═════════ REGISTER · VERIFY EMAIL ═════════ */}
                {mode === 'register-verify' && (
                    <form onSubmit={handleVerifyRegistration} className="space-y-4">
                        <div className="text-center mb-2">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 mb-3">
                                <Mail className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verify Your Email</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                We sent a 6-digit code to <strong>{pendingEmail}</strong>
                            </p>
                        </div>
                        <DevCodeBanner />
                        <OtpInput />
                        <SubmitButton loading={otpLoading}>Verify & Continue</SubmitButton>
                        <div className="text-center">
                            <button type="button" onClick={() => sendOtp(pendingEmail, 'registration')} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                Resend Code
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
