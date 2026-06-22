const VALID_BOOKING_STATUSES = [
    'booked',
    'rescheduled',
    'confirmed',
    'arrived',
    'in_service',
    'completed',
    'cancelled',
    'no_show',
];

const STATUS_LABELS = {
    booked: 'Booked',
    rescheduled: 'Rescheduled',
    confirmed: 'Confirmed',
    arrived: 'Arrived',
    in_service: 'In Service',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
};

const STATUS_CLASSES = {
    booked: {
        block: 'bg-yellow-200 border-yellow-500 text-yellow-900 dark:bg-yellow-900/60 dark:border-yellow-600 dark:text-yellow-200',
        badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
        border: 'border-l-yellow-500',
        dot: 'bg-yellow-500',
    },
    rescheduled: {
        block: 'bg-yellow-400 border-yellow-700 text-yellow-950 dark:bg-yellow-700/70 dark:border-yellow-500 dark:text-yellow-100',
        badge: 'bg-yellow-300 text-yellow-950 dark:bg-yellow-700/60 dark:text-yellow-100',
        border: 'border-l-yellow-700',
        dot: 'bg-yellow-700',
    },
    confirmed: {
        block: 'bg-blue-200 border-blue-500 text-blue-900 dark:bg-blue-900/60 dark:border-blue-600 dark:text-blue-200',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
        border: 'border-l-blue-500',
        dot: 'bg-blue-500',
    },
    arrived: {
        block: 'bg-gray-700 border-gray-950 text-white dark:bg-gray-800 dark:border-gray-900 dark:text-gray-200',
        badge: 'bg-gray-700 text-white dark:bg-gray-800 dark:text-gray-200',
        border: 'border-l-gray-700',
        dot: 'bg-gray-700',
    },
    in_service: {
        block: 'bg-green-200 border-green-500 text-green-900 dark:bg-green-900/60 dark:border-green-600 dark:text-green-200',
        badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
        border: 'border-l-green-500',
        dot: 'bg-green-500',
    },
    completed: {
        block: 'bg-[#8B4513] border-[#5C2E0B] text-white dark:bg-[#A0522D] dark:border-[#8B4513]',
        badge: 'bg-[#8B4513] text-white dark:bg-[#A0522D] dark:text-white',
        border: 'border-l-[#8B4513]',
        dot: 'bg-[#8B4513]',
    },
    cancelled: {
        block: 'bg-red-200 border-red-500 text-red-900 dark:bg-red-900/60 dark:border-red-600 dark:text-red-200',
        badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
        border: 'border-l-red-500',
        dot: 'bg-red-500',
    },
    no_show: {
        block: 'bg-orange-400 border-orange-600 text-white dark:bg-orange-600/80 dark:border-orange-500 dark:text-orange-100',
        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
        border: 'border-l-orange-500',
        dot: 'bg-orange-500',
    },
    default: {
        block: 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100',
        badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
        border: 'border-l-gray-300',
        dot: 'bg-gray-300',
    },
};

const EDIT_COMPLETED_BILLED_PASSWORD = '6492';

function normalizeBookingStatus(status) {
    const normalized = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (normalized === 'noshow') return 'no_show';
    if (normalized === 'inservice') return 'in_service';
    return normalized;
}

function isValidBookingStatus(status) {
    return VALID_BOOKING_STATUSES.includes(normalizeBookingStatus(status));
}

function getAllNextBookingStatuses(currentStatus) {
    const current = normalizeBookingStatus(currentStatus);
    return VALID_BOOKING_STATUSES.filter(status => status !== current);
}

function getBookingStatusLabel(status) {
    const normalized = normalizeBookingStatus(status);
    return STATUS_LABELS[normalized] || 'Unknown';
}

function getBookingStatusClasses(status) {
    const normalized = normalizeBookingStatus(status);
    return STATUS_CLASSES[normalized] || STATUS_CLASSES.default;
}

function parseStatusHistory(history) {
    if (!history) return [];
    if (Array.isArray(history)) return history;
    if (typeof history === 'string') {
        try {
            const parsed = JSON.parse(history);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function isBookingLocallyModified(booking) {
    if (!booking) return false;
    if (booking.isModifiedAfterMigration === true) return true;
    return parseStatusHistory(booking.statusHistory).some(entry => entry && entry.isLocalModified === true);
}

function isCompletedAndBilledLocked(booking) {
    return !!booking && normalizeBookingStatus(booking.status) === 'completed' && booking.billingStatus === 'billed';
}

function canEditCompletedBilledBooking(booking, role, password) {
    if (!isCompletedAndBilledLocked(booking)) return true;
    return role === 'SUPER_ADMIN' && String(password || '').trim() === EDIT_COMPLETED_BILLED_PASSWORD;
}

module.exports = {
    VALID_BOOKING_STATUSES,
    STATUS_LABELS,
    STATUS_CLASSES,
    EDIT_COMPLETED_BILLED_PASSWORD,
    normalizeBookingStatus,
    isValidBookingStatus,
    getAllNextBookingStatuses,
    getBookingStatusLabel,
    getBookingStatusClasses,
    parseStatusHistory,
    isBookingLocallyModified,
    isCompletedAndBilledLocked,
    canEditCompletedBilledBooking,
};
