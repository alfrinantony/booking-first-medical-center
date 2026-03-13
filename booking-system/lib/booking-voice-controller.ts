/**
 * BookingVoiceController
 *
 * Event bus that bridges the Voice Agent ↔ Booking Wizard.
 *
 * Voice Agent → emits booking commands (selectClinic, selectDoctor, etc.)
 * Booking Wizard → emits options (available clinics, services, doctors for the current step)
 *
 * Both sides subscribe to each other's events to stay in sync.
 */

type Listener = (...args: any[]) => void;

class BookingVoiceEventBus {
    private listeners: Map<string, Set<Listener>> = new Map();

    on(event: string, fn: Listener) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(fn);
        return () => this.off(event, fn);
    }

    off(event: string, fn: Listener) {
        this.listeners.get(event)?.delete(fn);
    }

    emit(event: string, ...args: any[]) {
        this.listeners.get(event)?.forEach(fn => {
            try { fn(...args); } catch (e) { console.error(`[VoiceController] Error in ${event}:`, e); }
        });
    }

    removeAllListeners() {
        this.listeners.clear();
    }
}

// Singleton instance
export const bookingVoiceController = new BookingVoiceEventBus();

/* ── Event types ── */

// Voice → Wizard: commands to select things
export const VOICE_EVENTS = {
    SELECT_CLINIC: 'voice:selectClinic',           // payload: { id, name }
    SELECT_DEPT: 'voice:selectDept',               // payload: { id, name }
    SELECT_CATEGORY: 'voice:selectCategory',       // payload: { id, name }
    SELECT_SERVICE: 'voice:selectService',         // payload: { id, name }
    SELECT_DOCTOR: 'voice:selectDoctor',           // payload: { id, name }
    SELECT_DATE: 'voice:selectDate',               // payload: { date: string }
    SELECT_SLOT: 'voice:selectSlot',               // payload: { time: string }
    CONFIRM: 'voice:confirm',                      // payload: none
    GO_BACK: 'voice:goBack',                       // payload: none
    NAVIGATE: 'voice:navigate',                    // payload: { page: 'booking' | 'dashboard' }
    LIST_BOOKINGS: 'voice:listBookings',           // payload: none
    CANCEL_BOOKING: 'voice:cancelBooking',         // payload: { bookingId?: string }
    RESCHEDULE_BOOKING: 'voice:rescheduleBooking', // payload: { bookingId?: string }
} as const;

// Wizard → Voice: context updates
export const WIZARD_EVENTS = {
    STEP_CHANGED: 'wizard:stepChanged',    // payload: { step: number, stepName: string }
    OPTIONS: 'wizard:options',        // payload: { step: number, items: { id: string, name: string }[] }
    SELECTION_MADE: 'wizard:selectionMade',  // payload: { step: number, selected: string }
    BOOKING_DONE: 'wizard:bookingDone',    // payload: { summary: string }
    ERROR: 'wizard:error',          // payload: { message: string }
} as const;

/* ── Fuzzy matching helper ── */
export function fuzzyMatch(query: string, options: { id: string; name: string }[]): { id: string; name: string } | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    // Exact match first
    const exact = options.find(o => o.name.toLowerCase() === q);
    if (exact) return exact;

    // Starts-with match
    const startsWith = options.find(o => o.name.toLowerCase().startsWith(q));
    if (startsWith) return startsWith;

    // Contains match
    const contains = options.find(o => o.name.toLowerCase().includes(q));
    if (contains) return contains;

    // Reverse contains (query contains option name)
    const reverseContains = options.find(o => q.includes(o.name.toLowerCase()));
    if (reverseContains) return reverseContains;

    // Word-level match: check if any word in the query matches any word in option names
    const qWords = q.split(/\s+/);
    for (const opt of options) {
        const optWords = opt.name.toLowerCase().split(/\s+/);
        const overlap = qWords.filter(w => optWords.some(ow => ow.includes(w) || w.includes(ow)));
        if (overlap.length > 0) return opt;
    }

    // Numeric index match: "first", "second", "1", "2" etc.
    const ordinals: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5, one: 0, two: 1, three: 2, four: 3, five: 4, six: 5 };
    const numMatch = q.match(/^(\d+)$/);
    if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < options.length) return options[idx];
    }
    for (const [word, idx] of Object.entries(ordinals)) {
        if (q.includes(word) && idx < options.length) return options[idx];
    }

    return null;
}

/* ── Step names ── */
export const STEP_NAMES = ['Category', 'Service', 'Date', 'Branch', 'Doctor', 'Time', 'Confirm'] as const;
