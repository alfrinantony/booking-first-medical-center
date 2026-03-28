const https = require('https');
https.get('https://fmc-booking-hdh3ftfzcuazfxg0.z02.azurefd.net/api/bookings', res => {
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            const match = data.find(x => x.id === 'i957q1tzw');
            console.log(match ? JSON.stringify(match, null, 2) : 'NOT FOUND IN ' + data.length + ' BOOKINGS');
        } catch (e) {
            console.error(e.message);
        }
    });
});
