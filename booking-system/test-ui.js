const { chromium } = require('playwright');

async function main() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Setup console log listener
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('response', response => {
        if (response.url().includes('/api/bookings')) {
            console.log(`API RESPONSE: ${response.url()} - ${response.status()}`);
        }
    });

    console.log("Navigating to admin appointments...");
    // Since there's no auth in dev, maybe it just works, or maybe we need to mock session
    await page.addInitScript(() => {
        window.sessionStorage.setItem('adminUser', JSON.stringify({ id: 'admin', name: 'Admin', role: 'super_admin' }));
    });
    
    await page.goto('http://localhost:3000/admin/appointments');
    await page.waitForTimeout(3000); // Wait for bookings to load

    console.log("Looking for Angelique's appointment...");
    // Find any appointment block containing "Angelique"
    const blocks = await page.$$('text="ANGELIQUE"');
    if (blocks.length === 0) {
        console.log("No appointment found for Angelique!");
    } else {
        console.log("Clicking appointment...");
        await blocks[0].click();
        await page.waitForTimeout(1000);

        console.log("Changing status...");
        // The status select should be visible
        await page.selectOption('select:has-text("Completed")', 'confirmed');
        await page.waitForTimeout(500);

        console.log("Clicking Save Changes...");
        // Find Save Changes button
        await page.click('text="Save Changes"');
        await page.waitForTimeout(2000);
    }

    await browser.close();
}

main().catch(console.error);
