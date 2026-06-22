import type { Booking } from './data';

export type BookingStatus = Booking['status'];

export const VALID_BOOKING_STATUSES: BookingStatus[];
export const STATUS_LABELS: Record<BookingStatus, string>;
export const EDIT_COMPLETED_BILLED_PASSWORD: string;
export const STATUS_CLASSES: Record<string, {
    block: string;
    badge: string;
    border: string;
    dot: string;
}>;

export function normalizeBookingStatus(status: unknown): string;
export function isValidBookingStatus(status: unknown): boolean;
export function getAllNextBookingStatuses(currentStatus: unknown): BookingStatus[];
export function getBookingStatusLabel(status: unknown): string;
export function getBookingStatusClasses(status: unknown): {
    block: string;
    badge: string;
    border: string;
    dot: string;
};
export function parseStatusHistory(history: unknown): Array<Record<string, unknown>>;
export function isBookingLocallyModified(booking: unknown): boolean;
export function isCompletedAndBilledLocked(booking: unknown): boolean;
export function canEditCompletedBilledBooking(booking: unknown, role: unknown, password: unknown): boolean;
