export function maskPhone(phone: string | undefined): string {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '•'.repeat(phone.length);
    const visible = phone.slice(0, Math.min(7, phone.length - 3));
    const masked = '•'.repeat(Math.max(0, phone.length - visible.length - 2));
    const tail = phone.slice(-2);
    return visible + masked + tail;
}

export function maskEmail(email: string | undefined): string {
    if (!email) return '—';
    const [local, domain] = email.split('@');
    if (!domain) return '•'.repeat(email.length);
    const visibleLocal = local.slice(0, Math.min(2, local.length));
    const maskedLocal = '•'.repeat(Math.max(0, local.length - 2));
    return `${visibleLocal}${maskedLocal}@${domain}`;
}
