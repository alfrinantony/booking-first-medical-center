import 'dotenv/config';
import fetch from 'node-fetch';

async function test() {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    const pageId = process.env.META_PAGE_ID;
    const url = `https://graph.facebook.com/v21.0/${pageId}/conversations?access_token=${pageAccessToken}`;
    console.log("Fetching FB convos...");
    const res = await fetch(url);
    const json = await res.json();
    console.log(JSON.stringify(json).substring(0, 500));
}
test().catch(console.error);
