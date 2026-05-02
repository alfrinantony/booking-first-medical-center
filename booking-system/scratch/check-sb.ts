import { SimplybookStore } from '../lib/simplybook-store';

async function test() {
    const list = await SimplybookStore.getAll();
    const bad = list.filter(b => !b.startDateTime);
    console.log(`Found ${bad.length} records with empty startDateTime out of ${list.length}`);
    if (bad.length > 0) {
        console.log(bad[0]);
    }
}
test();
