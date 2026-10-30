/**
 * Dummy deals and transactions for demos. Attaches to the dummy contacts created by
 * scripts/seed-dummy.ts (run that first). Dates are relative to "now".
 * Idempotent: skips if deals for dummy (@example.com) contacts already exist.
 *
 * Usage:  npx tsx scripts/seed-dummy-deals.ts
 */
import { PrismaClient, DealStage, TransactionStatus, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

type TxSpec = {
  type: TransactionType; status: TransactionStatus; pct: number; day: number; description: string;
};

const DEALS: Array<{
  name: string; value: number; stage: DealStage; probability: number; closeDay: number;
  contactEmail: string; description: string; transactions?: TxSpec[];
}> = [
  { name: 'Fleet Tracking Platform', value: 84000, stage: 'CLOSED_WON', probability: 100, closeDay: -75, contactEmail: 'olivia.martinez@example.com', description: 'Annual license for 300 vehicles.',
    transactions: [
      { type: 'INVOICE', status: 'COMPLETED', pct: 0.5, day: -74, description: 'Invoice 1/2 - 50% upfront' },
      { type: 'PAYMENT', status: 'COMPLETED', pct: 0.5, day: -66, description: 'Payment received - invoice 1/2' },
      { type: 'INVOICE', status: 'COMPLETED', pct: 0.5, day: -30, description: 'Invoice 2/2 - balance' },
      { type: 'PAYMENT', status: 'COMPLETED', pct: 0.5, day: -18, description: 'Payment received - invoice 2/2' },
    ] },
  { name: 'Platform Migration Services', value: 56000, stage: 'CLOSED_WON', probability: 100, closeDay: -50, contactEmail: 'emma.johnson@example.com', description: 'Cloud migration and onboarding package.',
    transactions: [
      { type: 'INVOICE', status: 'COMPLETED', pct: 1, day: -49, description: 'Invoice - migration services' },
      { type: 'PAYMENT', status: 'COMPLETED', pct: 1, day: -35, description: 'Payment received - wire transfer' },
    ] },
  { name: 'POS Analytics Suite', value: 128000, stage: 'CLOSED_WON', probability: 100, closeDay: -28, contactEmail: 'sophia.garcia@example.com', description: 'Analytics rollout across 40 stores.',
    transactions: [
      { type: 'INVOICE', status: 'COMPLETED', pct: 0.4, day: -27, description: 'Invoice 1/3 - kickoff' },
      { type: 'PAYMENT', status: 'COMPLETED', pct: 0.4, day: -20, description: 'Payment received - invoice 1/3' },
      { type: 'INVOICE', status: 'PENDING', pct: 0.6, day: -5, description: 'Invoice 2/3 - go-live milestone' },
    ] },
  { name: 'Advisory Retainer Q4', value: 36000, stage: 'CLOSED_WON', probability: 100, closeDay: -14, contactEmail: 'james.rossi@example.com', description: 'Quarterly advisory retainer.',
    transactions: [
      { type: 'INVOICE', status: 'COMPLETED', pct: 1, day: -13, description: 'Invoice - Q4 retainer' },
      { type: 'PAYMENT', status: 'FAILED', pct: 1, day: -8, description: 'Card payment declined' },
      { type: 'PAYMENT', status: 'COMPLETED', pct: 1, day: -3, description: 'Payment received - ACH retry' },
      { type: 'REFUND', status: 'COMPLETED', pct: 0.1, day: -1, description: 'Partial refund - billing adjustment' },
    ] },
  { name: 'Warehouse Routing Add-on', value: 22000, stage: 'CLOSED_WON', probability: 100, closeDay: -7, contactEmail: 'liam.chen@example.com', description: 'Upsell to existing fleet customer.',
    transactions: [
      { type: 'INVOICE', status: 'PENDING', pct: 1, day: -6, description: 'Invoice - routing add-on, net 30' },
    ] },
  { name: 'Clinical Data Integration', value: 96000, stage: 'NEGOTIATION', probability: 75, closeDay: 18, contactEmail: 'ava.williams@example.com', description: 'Awaiting security review sign-off.' },
  { name: 'Treasury Reporting Dashboard', value: 72000, stage: 'NEGOTIATION', probability: 70, closeDay: 25, contactEmail: 'mia.thompson@example.com', description: 'Legal reviewing MSA redlines.' },
  { name: 'Store Systems Refresh', value: 64000, stage: 'PROPOSAL_SENT', probability: 55, closeDay: 32, contactEmail: 'mason.kim@example.com', description: 'Proposal sent, follow-up scheduled.' },
  { name: 'Developer Portal Build', value: 31000, stage: 'PROPOSAL_SENT', probability: 50, closeDay: 28, contactEmail: 'noah.patel@example.com', description: 'Two-phase fixed-fee proposal.' },
  { name: 'Finance Team Training', value: 14500, stage: 'PROPOSAL', probability: 40, closeDay: 40, contactEmail: 'ethan.brown@example.com', description: 'Drafting proposal for workshop series.' },
  { name: 'Emissions Reporting Pilot', value: 45000, stage: 'QUALIFIED', probability: 30, closeDay: 55, contactEmail: 'isabella.nguyen@example.com', description: 'Met at industry event; pilot scoping underway.' },
  { name: 'Supplier Portal Discovery', value: 18000, stage: 'LEAD', probability: 10, closeDay: 70, contactEmail: 'liam.chen@example.com', description: 'Inbound inquiry, needs discovery call.' },
  { name: 'Win-back: Energy Ops Suite', value: 38000, stage: 'CLOSED_LOST', probability: 0, closeDay: -21, contactEmail: 'lucas.anderson@example.com', description: 'Lost on pricing; churned customer.' },
  { name: 'Retail Loyalty Integration', value: 52000, stage: 'CLOSED_LOST', probability: 0, closeDay: -40, contactEmail: 'mason.kim@example.com', description: 'Chose in-house build.' },
];

// Standalone transactions (no deal), e.g. subscriptions and one-off services.
const STANDALONE: Array<{ contactEmail: string; type: TransactionType; status: TransactionStatus; amount: number; day: number; description: string }> = [
  { contactEmail: 'olivia.martinez@example.com', type: 'PAYMENT', status: 'COMPLETED', amount: 2400, day: -45, description: 'Monthly support plan' },
  { contactEmail: 'olivia.martinez@example.com', type: 'PAYMENT', status: 'COMPLETED', amount: 2400, day: -15, description: 'Monthly support plan' },
  { contactEmail: 'emma.johnson@example.com', type: 'INVOICE', status: 'COMPLETED', amount: 4800, day: -22, description: 'Premium support - 2 months' },
  { contactEmail: 'emma.johnson@example.com', type: 'PAYMENT', status: 'COMPLETED', amount: 4800, day: -12, description: 'Premium support - 2 months' },
  { contactEmail: 'sophia.garcia@example.com', type: 'PAYMENT', status: 'PENDING', amount: 1500, day: -2, description: 'Training workshop deposit' },
  { contactEmail: 'james.rossi@example.com', type: 'REFUND', status: 'COMPLETED', amount: 600, day: -10, description: 'Duplicate charge refund' },
  { contactEmail: 'ava.williams@example.com', type: 'INVOICE', status: 'PENDING', amount: 3200, day: -4, description: 'Security assessment fee' },
];

async function main() {
  const existing = await prisma.deal.count({ where: { contact: { email: { endsWith: '@example.com' } } } });
  if (existing > 0) {
    console.log(`[dummy-deals] ${existing} dummy deals already exist - nothing to do.`);
    return;
  }

  const contacts = await prisma.contact.findMany({ where: { email: { endsWith: '@example.com' } } });
  if (contacts.length === 0) {
    throw new Error('No dummy contacts found. Run `npx tsx scripts/seed-dummy.ts` first.');
  }
  const byEmail = new Map(contacts.map((c) => [c.email!, c]));
  const find = (email: string) => {
    const c = byEmail.get(email);
    if (!c) throw new Error(`Dummy contact ${email} not found.`);
    return c;
  };

  let deals = 0;
  let txs = 0;
  for (const d of DEALS) {
    const contact = find(d.contactEmail);
    const deal = await prisma.deal.create({
      data: {
        name: d.name,
        value: d.value,
        stage: d.stage,
        probability: d.probability,
        closeDate: daysFromNow(d.closeDay),
        description: d.description,
        ownerId: contact.ownerId,
        contactId: contact.id,
        companyId: contact.companyId,
        createdAt: daysFromNow(Math.min(d.closeDay, 0) - 45),
      },
    });
    deals++;
    for (const t of d.transactions ?? []) {
      await prisma.transaction.create({
        data: {
          amount: Math.round(d.value * t.pct),
          type: t.type,
          status: t.status,
          date: daysFromNow(t.day),
          description: t.description,
          contactId: contact.id,
          dealId: deal.id,
        },
      });
      txs++;
    }
  }

  for (const s of STANDALONE) {
    await prisma.transaction.create({
      data: {
        amount: s.amount,
        type: s.type,
        status: s.status,
        date: daysFromNow(s.day),
        description: s.description,
        contactId: find(s.contactEmail).id,
      },
    });
    txs++;
  }

  console.log(`[dummy-deals] Created ${deals} deals and ${txs} transactions.`);
}

main()
  .catch((e) => {
    console.error('[dummy-deals] Error:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
