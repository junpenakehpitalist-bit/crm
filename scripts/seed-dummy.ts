/**
 * Dummy data for local development: companies and contacts (all emails use example.com).
 * Idempotent: skips if dummy contacts already exist.
 *
 * Usage:  npx tsx scripts/seed-dummy.ts
 */
import { PrismaClient, LifecycleStage } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANIES = [
  { name: 'Acme Logistics', industry: 'Logistics', website: 'https://acme-logistics.example.com', phone: '+1 415 555 0101', address: '120 Market St, San Francisco, CA', employeeCount: 250, annualRevenue: 18000000 },
  { name: 'Brightwave Software', industry: 'Software', website: 'https://brightwave.example.com', phone: '+1 206 555 0102', address: '800 5th Ave, Seattle, WA', employeeCount: 85, annualRevenue: 9500000 },
  { name: 'Cedar Health Partners', industry: 'Healthcare', website: 'https://cedarhealth.example.com', phone: '+1 512 555 0103', address: '45 Congress Ave, Austin, TX', employeeCount: 430, annualRevenue: 42000000 },
  { name: 'Delta Retail Group', industry: 'Retail', website: 'https://deltaretail.example.com', phone: '+1 312 555 0104', address: '300 W Adams St, Chicago, IL', employeeCount: 1200, annualRevenue: 130000000 },
  { name: 'Evergreen Energy', industry: 'Energy', website: 'https://evergreen-energy.example.com', phone: '+1 303 555 0105', address: '1600 Broadway, Denver, CO', employeeCount: 160, annualRevenue: 27000000 },
  { name: 'Fjord Financial', industry: 'Finance', website: 'https://fjordfinancial.example.com', phone: '+1 212 555 0106', address: '1 Wall St, New York, NY', employeeCount: 320, annualRevenue: 56000000 },
];

const CONTACTS: Array<{
  firstName: string; lastName: string; jobTitle: string; company: number;
  stage: LifecycleStage; tags: string[]; notes?: string;
}> = [
  { firstName: 'Olivia', lastName: 'Martinez', jobTitle: 'VP of Operations', company: 0, stage: 'CUSTOMER', tags: ['key-account'], notes: 'Renewal due next quarter.' },
  { firstName: 'Liam', lastName: 'Chen', jobTitle: 'Procurement Manager', company: 0, stage: 'PROSPECT', tags: ['procurement'] },
  { firstName: 'Emma', lastName: 'Johnson', jobTitle: 'CTO', company: 1, stage: 'CUSTOMER', tags: ['technical', 'key-account'] },
  { firstName: 'Noah', lastName: 'Patel', jobTitle: 'Engineering Lead', company: 1, stage: 'LEAD', tags: ['technical'] },
  { firstName: 'Ava', lastName: 'Williams', jobTitle: 'Director of IT', company: 2, stage: 'PROSPECT', tags: ['healthcare'], notes: 'Asked for a security questionnaire.' },
  { firstName: 'Ethan', lastName: 'Brown', jobTitle: 'CFO', company: 2, stage: 'LEAD', tags: ['finance'] },
  { firstName: 'Sophia', lastName: 'Garcia', jobTitle: 'Head of Merchandising', company: 3, stage: 'CUSTOMER', tags: ['retail'] },
  { firstName: 'Mason', lastName: 'Kim', jobTitle: 'Store Systems Manager', company: 3, stage: 'PROSPECT', tags: ['retail', 'technical'] },
  { firstName: 'Isabella', lastName: 'Nguyen', jobTitle: 'Sustainability Director', company: 4, stage: 'LEAD', tags: ['event-lead'] },
  { firstName: 'Lucas', lastName: 'Anderson', jobTitle: 'Operations Manager', company: 4, stage: 'CHURNED', tags: ['churn-risk'], notes: 'Left after pricing change.' },
  { firstName: 'Mia', lastName: 'Thompson', jobTitle: 'Chief Risk Officer', company: 5, stage: 'PROSPECT', tags: ['finance', 'decision-maker'] },
  { firstName: 'James', lastName: 'Rossi', jobTitle: 'Account Executive', company: 5, stage: 'CUSTOMER', tags: ['finance'] },
];

async function main() {
  const existing = await prisma.contact.count({ where: { email: { endsWith: '@example.com' } } });
  if (existing > 0) {
    console.log(`[dummy] ${existing} dummy contacts already exist - nothing to do.`);
    return;
  }

  const owner = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });

  const companies = [];
  for (const c of COMPANIES) {
    companies.push(await prisma.company.create({ data: { ...c, ownerId: owner?.id } }));
  }

  let n = 0;
  for (const c of CONTACTS) {
    const company = companies[c.company];
    const domain = new URL(company.website!).hostname;
    await prisma.contact.create({
      data: {
        firstName: c.firstName,
        lastName: c.lastName,
        email: `${c.firstName}.${c.lastName}@example.com`.toLowerCase(),
        phone: `+1 555 01${String(10 + n).padStart(2, '0')}`,
        jobTitle: c.jobTitle,
        address: company.address,
        lifecycleStage: c.stage,
        tags: c.tags,
        notes: c.notes ?? `Works at ${company.name} (${domain}).`,
        ownerId: owner?.id,
        companyId: company.id,
      },
    });
    n++;
  }
  console.log(`[dummy] Created ${companies.length} companies and ${n} contacts.`);
}

main()
  .catch((e) => {
    console.error('[dummy] Error:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
