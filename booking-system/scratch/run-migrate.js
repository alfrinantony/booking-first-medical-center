async function checkClients() {
    try {
        console.log('Sending request to /api/admin/clients...');
        const res = await fetch('https://ai.dubaifmc.com/api/admin/clients');
        console.log(res.status, (await res.text()).substring(0, 200));
    } catch(e) { console.error(e); }
}
checkClients();
