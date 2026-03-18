const scheduleStartMin = 10 * 60; // 10:00 AM
const scheduleEndMin = 18 * 60;   // 6:00 PM (18:00)

const availableMinutesSet = new Set<number>();
for (let i = scheduleStartMin; i < scheduleEndMin; i += 15) {
    availableMinutesSet.add(i);
}

const requestedDuration = 45;
const CLINIC_OPENING_MINUTES = 10 * 60;
let slots: string[] = [];

for (let startMin = CLINIC_OPENING_MINUTES; startMin + requestedDuration <= scheduleEndMin; startMin += requestedDuration) {
    let allAvailable = true;
    for (let checkpoint = startMin; checkpoint < startMin + requestedDuration; checkpoint += 15) {
        if (!availableMinutesSet.has(checkpoint)) {
            allAvailable = false;
            break;
        }
    }
    if (allAvailable) {
        let h = Math.floor(startMin / 60);
        const m = startMin % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`);
    }
}
console.log("Slots:", slots);
