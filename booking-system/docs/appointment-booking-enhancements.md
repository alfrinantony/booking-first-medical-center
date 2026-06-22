# Appointment Booking Enhancements

## Scope

This update fixes migrated appointment status editing, protects locally edited SimplyBook imports from future overwrite, improves import diagnostics, standardizes appointment status display, and opens the billing workflow when an appointment is completed.

## Migrated Booking Edits

- Migrated appointments can now move from any valid status to any other valid status.
- The booking API validates and normalizes status values before saving.
- Status changes are persisted through `BookingsStore.update`.
- Status changes add a status-history entry and an `UPDATE_BOOKING_STATUS` audit log.

## SimplyBook Sync Protection

- Migrated bookings use the existing `isModifiedAfterMigration` database field.
- When a SimplyBook-sourced booking is locally edited, the booking is marked modified.
- Future SimplyBook batch imports and webhook status updates skip locally modified bookings.
- The original SimplyBook reference remains on the booking through `sbId` and related `sb*` fields.

## Import Mapping

The SimplyBook import maps:

- Patient name, phone, and email
- Service, branch, and doctor
- Appointment date and time
- Payment status and invoice metadata when available

Duplicate imports are prevented by `sbId`. Missing mapped fields are logged to the console during import and summarized in a `SIMPLYBOOK_IMPORT_MISSING_DATA` audit entry.

## Status Colors

Status colors are centralized in `lib/booking-status-rules.js` and reused by the calendar, day list, edit modal, and status history.

- Booked: Yellow
- Rescheduled: Dark Yellow
- Confirmed: Blue
- Arrived: Dark Gray
- In Service: Green
- Completed: Brown
- Cancelled: Red
- No Show: Orange
- Unknown: Light Gray

## Billing Completion Flow

- When an appointment is saved as `completed`, the appointment API marks it `pending_bill` unless it is already billed.
- The appointment UI opens `/admin/billing` with the booking id and SimplyBook reference.
- Billing pre-fills patient, phone, appointment number, service, doctor, branch, and date/time from the linked booking.
- The billing API prevents duplicate invoices by booking id, SimplyBook id, or online reference.
- If an invoice already exists, the billing UI warns staff and requires explicit confirmation before a duplicate invoice can be created.
- Invoice generation records an `INVOICE_GENERATED` audit log and marks the linked booking as billed.

## Verification

Run focused tests with:

```bash
npm run test
```
