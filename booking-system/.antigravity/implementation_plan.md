# Redesign Day View Calendar

The user requested changing the "Day" view of the appointment calendar to a timeline-based grid view where:
1. Appointments are rendered as blocks whose height is proportional to the service's duration.
2. The color of each appointment block varies by the department of the service.
3. Appointments accurately overlap/sit side-by-side if they happen simultaneously.

## Proposed Changes

### `app/admin/appointments/page.tsx`
- **Helper Functions:**
  - `parseTime(slotStr)`: Converts strings like "10:15 AM" into absolute minutes from midnight (e.g., 615).
  - `calculateOverlaps(bookings)`: Implements a collision-detection algorithm to determine column position and width for overlapping appointments so they render side-by-side.
  - `getDeptColor(deptId)`: Returns a distinct Tailwind color theme based on the index of the department in `deptOptions`.

- **Day View Rendering (`viewMode === 'day'`):**
  - Change the container structure to a `relative` positioned container.
  - Render the horizontal time slot grid (lines and timestamps) as a fixed background structure.
  - Iteratively map over `dayBookings` (and `daySbBookings` if applicable), rendering them as `absolute` positioned divs over the grid.
  - Calculate `top` using `(startMins - 600) / 15 * 44px` (assuming 10:00 AM start, 15 min intervals, and 44px row height).
  - Calculate `height` using `duration / 15 * 44px`.

## User Review Required

> [!IMPORTANT]
> **SimplyBook Appointments in Day View**
> Currently, the day view only lists appointments booked natively in the app, but not the unmerged ones sitting in the "SimplyBook" cache (those are only shown as a `+X SB` count badge in the month view). Since we are upgrading the Day view to a visual grid, should we also render unmerged SimplyBook appointments on this grid?

> [!WARNING]
> **Mobile Responsiveness**
> A heavily overlapping time grid can become squished on very small screens. I will ensure a `min-width` is maintained and horizontal scrolling is enabled for the day view if there are many overlapping appointments.

## Verification Plan
1. Ensure the Day view accurately reflects a 30-minute appointment as exactly two 15-minute grid rows high.
2. Verify overlapping appointments align side-by-side gracefully.
3. Check that the color accurately corresponds to the department selection.
