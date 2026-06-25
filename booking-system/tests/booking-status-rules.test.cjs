const test = require('node:test');
const assert = require('node:assert/strict');

const {
    VALID_BOOKING_STATUSES,
    normalizeBookingStatus,
    isValidBookingStatus,
    getAllNextBookingStatuses,
    getBookingStatusLabel,
    getBookingStatusClasses,
    parseStatusHistory,
    isBookingLocallyModified,
    isCompletedAndBilledLocked,
    canEditCompletedBilledBooking,
} = require('../lib/booking-status-rules.js');

const {
    getMissingSimplyBookBookingFields,
    hasRequiredSimplyBookBookingDetails,
    hasRequiredAppBookingDetails,
} = require('../lib/simplybook-booking-rules.js');

test('normalizes and validates every supported booking status', () => {
    assert.deepEqual(VALID_BOOKING_STATUSES, [
        'booked',
        'rescheduled',
        'confirmed',
        'arrived',
        'in_service',
        'completed',
        'cancelled',
        'no_show',
    ]);
    assert.equal(normalizeBookingStatus('No Show'), 'no_show');
    assert.equal(normalizeBookingStatus('in-service'), 'in_service');
    assert.equal(isValidBookingStatus('Completed'), true);
    assert.equal(isValidBookingStatus('waiting_room'), false);
});

test('allows changing from any status to any other status', () => {
    const nextStatuses = getAllNextBookingStatuses('confirmed');
    assert.equal(nextStatuses.includes('booked'), true);
    assert.equal(nextStatuses.includes('completed'), true);
    assert.equal(nextStatuses.includes('confirmed'), false);
    assert.equal(nextStatuses.length, VALID_BOOKING_STATUSES.length - 1);
});

test('returns consistent labels and colors for the required status map', () => {
    assert.equal(getBookingStatusLabel('in_service'), 'In Service');
    assert.match(getBookingStatusClasses('booked').block, /yellow/);
    assert.match(getBookingStatusClasses('rescheduled').block, /yellow-4|yellow-7/);
    assert.match(getBookingStatusClasses('confirmed').block, /blue/);
    assert.match(getBookingStatusClasses('arrived').block, /gray-7|gray-8/);
    assert.match(getBookingStatusClasses('in_service').block, /green/);
    assert.match(getBookingStatusClasses('completed').block, /8B4513/);
    assert.match(getBookingStatusClasses('cancelled').block, /red/);
    assert.match(getBookingStatusClasses('no_show').block, /orange/);
    assert.match(getBookingStatusClasses('unknown').block, /gray/);
});

test('detects locally modified migrated bookings', () => {
    assert.equal(isBookingLocallyModified({ isModifiedAfterMigration: true }), true);
    assert.equal(isBookingLocallyModified({
        statusHistory: [{ newStatus: 'completed', isLocalModified: true }],
    }), true);
    assert.equal(isBookingLocallyModified({
        statusHistory: JSON.stringify([{ newStatus: 'completed' }]),
    }), false);
    assert.deepEqual(parseStatusHistory('not json'), []);
});

test('locks completed and billed bookings unless super admin password is provided', () => {
    const lockedBooking = { status: 'completed', billingStatus: 'billed' };
    assert.equal(isCompletedAndBilledLocked(lockedBooking), true);
    assert.equal(canEditCompletedBilledBooking(lockedBooking, 'ADMIN', '6492'), false);
    assert.equal(canEditCompletedBilledBooking(lockedBooking, 'SUPER_ADMIN', 'wrong'), false);
    assert.equal(canEditCompletedBilledBooking(lockedBooking, 'SUPER_ADMIN', '6492'), true);
    assert.equal(canEditCompletedBilledBooking({ status: 'completed' }, 'ADMIN', ''), true);
});

test('requires SimplyBook records to have client email and booking details', () => {
    assert.equal(hasRequiredSimplyBookBookingDetails({
        clientName: 'Aisha Khan',
        clientEmail: 'aisha@example.com',
        serviceName: 'Hydrafacial',
        providerName: 'Dr. Sara',
        date: '2026-06-22',
        time: '10:00',
    }), true);

    assert.deepEqual(getMissingSimplyBookBookingFields({
        clientName: 'Unknown Client',
        clientEmail: '',
        serviceName: 'Service #44',
        providerName: 'Provider #9',
        date: '',
        time: '',
    }), ['clientName', 'clientEmail', 'service', 'doctor', 'appointmentDate', 'appointmentTime']);
});

test('requires app bookings shown on the active page to have client and booking details', () => {
    assert.equal(hasRequiredAppBookingDetails({
        patientName: 'Aisha Khan',
        email: 'aisha@example.com',
        serviceName: 'Hydrafacial',
        date: '2026-06-22',
        slot: '10:00 AM',
    }), true);

    // Empty email is valid (optional)
    assert.equal(hasRequiredAppBookingDetails({
        patientName: 'Aisha Khan',
        email: '',
        serviceName: 'Hydrafacial',
        date: '2026-06-22',
        slot: '10:00 AM',
    }), true);

    // Invalid email is also allowed for display
    assert.equal(hasRequiredAppBookingDetails({
        patientName: 'Aisha Khan',
        email: 'missing',
        serviceName: 'Hydrafacial',
        date: '2026-06-22',
        slot: '10:00 AM',
    }), true);

    // Missing patientName should fail
    assert.equal(hasRequiredAppBookingDetails({
        patientName: '',
        email: 'aisha@example.com',
        serviceName: 'Hydrafacial',
        date: '2026-06-22',
        slot: '10:00 AM',
    }), false);
});
