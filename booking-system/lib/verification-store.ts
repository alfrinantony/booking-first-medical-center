/**
 * In-memory OTP verification store.
 * Stores 6-digit codes with 10-minute expiry for email verification
 * and password reset flows.
 */

interface OtpEntry {
    code: string;
    email: string;
    purpose: 'registration' | 'password-reset';
    expiresAt: number; // Unix timestamp
    used: boolean;
}

let otpStore: OtpEntry[] = [];

// Clean up expired entries periodically
function cleanup() {
    const now = Date.now();
    otpStore = otpStore.filter(entry => entry.expiresAt > now && !entry.used);
}

export const VerificationStore = {
    /**
     * Generate a 6-digit OTP code for the given email and purpose.
     * Invalidates any previous codes for the same email + purpose.
     */
    generateOtp: (email: string, purpose: 'registration' | 'password-reset'): string => {
        cleanup();

        // Invalidate previous codes for same email + purpose
        otpStore = otpStore.filter(
            entry => !(entry.email === email && entry.purpose === purpose)
        );

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        otpStore.push({
            code,
            email,
            purpose,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
            used: false,
        });

        return code;
    },

    /**
     * Verify an OTP code. Returns true if valid, false otherwise.
     * A valid code is consumed (marked as used) after verification.
     */
    verifyOtp: (email: string, code: string, purpose: 'registration' | 'password-reset'): boolean => {
        cleanup();

        const entry = otpStore.find(
            e => e.email === email && e.code === code && e.purpose === purpose && !e.used
        );

        if (!entry) return false;
        if (entry.expiresAt < Date.now()) return false;

        entry.used = true;
        return true;
    },
};
