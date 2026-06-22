async function main() {
    const res = await fetch('http://localhost:3000/api/admin/bookings');
    const bookings = await res.json();
    const angelique = bookings.find(b => b.patientName && b.patientName.includes('ANGELIQUE'));
    console.log("Angelique:", JSON.stringify(angelique, null, 2));
}

main().catch(console.error);
