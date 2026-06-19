async function test() {
    try {
        console.log('Fetching logs from live server...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/logs');
        const logs = await res.json();
        
        let count = 0;
        for (const log of logs) {
            if (log.action === 'ERROR_BOOKING_UPDATE' || log.action.includes('ERROR')) {
                console.log(log.timestamp, log.action, log.details);
                count++;
                if (count > 5) break;
            }
        }
        if (count === 0) console.log('No error logs found.');
    } catch(e) { console.error(e); }
}
test();
