import { SimplybookStore } from '../lib/simplybook-store';

async function main() {
  const records = await SimplybookStore.getByDate('2026-06-13');
  console.log(records.filter(r => r.clientName && r.clientName.includes('Elvira')).map(r => ({
    sbId: r.sbId,
    status: r.status,
    payment: r.paymentStatus,
    time: r.time
  })));
}

main().catch(console.error);
