const PLACEHOLDER_PATIENT_PATTERNS = [
    /^unknown\s+(client|patient)$/i,
    /^client\s*#?/i,
    /^patient\s*#?/i,
];

const PLACEHOLDER_SERVICE_PATTERNS = [
    /^unknown\s+service$/i,
    /^service\s*#/i,
    /^booking\s*#/i,
];

const PLACEHOLDER_PROVIDER_PATTERNS = [
    /^unknown\s+provider$/i,
    /^provider\s*#/i,
    /^staff$/i,
];

function cleanText(value) {
    return String(value || '').trim();
}

function hasMeaningfulValue(value, placeholderPatterns) {
    const text = cleanText(value);
    if (!text) return false;
    return !placeholderPatterns.some(pattern => pattern.test(text));
}

function hasValidEmail(value) {
    const email = cleanText(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMissingSimplyBookBookingFields(record) {
    const missing = [];

    if (!hasMeaningfulValue(record && record.clientName, PLACEHOLDER_PATIENT_PATTERNS)) {
        missing.push('clientName');
    }
    if (!hasValidEmail(record && record.clientEmail)) {
        missing.push('clientEmail');
    }
    if (!hasMeaningfulValue(record && record.serviceName, PLACEHOLDER_SERVICE_PATTERNS)) {
        missing.push('service');
    }
    if (!hasMeaningfulValue(record && record.providerName, PLACEHOLDER_PROVIDER_PATTERNS)) {
        missing.push('doctor');
    }
    if (!cleanText(record && record.date)) {
        missing.push('appointmentDate');
    }
    if (!cleanText(record && (record.time || (record.startDateTime || '').split(' ')[1]))) {
        missing.push('appointmentTime');
    }

    return missing;
}

function hasRequiredSimplyBookBookingDetails(record) {
    return getMissingSimplyBookBookingFields(record).filter(f => f !== 'clientEmail').length === 0;
}

function getMissingAppBookingFields(booking) {
    const missing = [];

    if (!hasMeaningfulValue(booking && booking.patientName, PLACEHOLDER_PATIENT_PATTERNS)) {
        missing.push('patientName');
    }
    if (!hasValidEmail(booking && booking.email)) {
        missing.push('email');
    }
    if (!hasMeaningfulValue(
        booking && (booking.serviceName || booking.sbServiceName || booking.serviceId),
        PLACEHOLDER_SERVICE_PATTERNS
    )) {
        missing.push('service');
    }
    if (!cleanText(booking && booking.date)) {
        missing.push('appointmentDate');
    }
    if (!cleanText(booking && booking.slot)) {
        missing.push('appointmentTime');
    }

    return missing;
}

function hasRequiredAppBookingDetails(booking) {
    return getMissingAppBookingFields(booking).filter(f => f !== 'email').length === 0;
}

module.exports = {
    cleanText,
    hasValidEmail,
    getMissingSimplyBookBookingFields,
    hasRequiredSimplyBookBookingDetails,
    getMissingAppBookingFields,
    hasRequiredAppBookingDetails,
};
