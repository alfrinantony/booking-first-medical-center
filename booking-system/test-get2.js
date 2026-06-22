async function main() {
    const res = await fetch('http://localhost:3000/api/bookings/1arfskox9');
    const b = await res.json();
    console.log("Booking:", JSON.stringify(b, null, 2));
}

main().catch(console.error);
