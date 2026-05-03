const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture unhandled errors
    page.on('pageerror', error => {
        console.error('PAGE ERROR:', error.message);
    });

    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('CONSOLE ERROR:', msg.text());
        }
    });

    try {
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
        await page.evaluate(() => {
            sessionStorage.setItem('adminUser', JSON.stringify({ id: '1', name: 'Super Admin', role: 'SUPER_ADMIN', permissions: { reassign_doctor: ['allow'] } }));
        });
        await page.goto('http://localhost:3000/admin/appointments', { waitUntil: 'networkidle2' });
        console.log('Page loaded!');
        // Wait a bit to ensure all useEffects run
        await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
        console.error('NAVIGATION ERROR:', err);
    }
    
    await browser.close();
})();
