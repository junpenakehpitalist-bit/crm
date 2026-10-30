/**
 * Production-safe, idempotent seed.
 *
 *  - Creates the default pipeline stages (upsert, never deletes anything).
 *  - Creates the first ADMIN user from environment variables, if provided:
 *      ADMIN_EMAIL, ADMIN_PASSWORD (min 10 chars), ADMIN_NAME (optional)
 *    If the user already exists it is left untouched, unless ADMIN_RESET_PASSWORD=true,
 *    in which case the password is reset and the user is (re)activated as ADMIN.
 *
 * Usage:  npx tsx scripts/seed-production.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STAGES = [
  { name: 'Lead', order: 1, color: '#64748b' },
  { name: 'Qualified', order: 2, color: '#3b82f6' },
  { name: 'Proposal', order: 3, color: '#6366f1' },
  { name: 'Proposal Sent', order: 4, color: '#8b5cf6' },
  { name: 'Negotiation', order: 5, color: '#f59e0b' },
  { name: 'Closed Won', order: 6, color: '#22c55e' },
  { name: 'Closed Lost', order: 7, color: '#ef4444' },
];

async function main() {
  console.log('[seed] Upserting pipeline stages...');
  for (const stage of STAGES) {
    await prisma.pipelineStage.upsert({
      where: { order: stage.order },
      update: { name: stage.name, color: stage.color },
      create: stage,
    });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const reset = process.env.ADMIN_RESET_PASSWORD === 'true';

  if (!email || !password) {
    console.log('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin user creation.');
  } else if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters long.');
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: { email, name, password: await bcrypt.hash(password, 12), role: 'ADMIN', active: true },
      });
      console.log(`[seed] Created admin user ${email}.`);
    } else if (reset) {
      await prisma.user.update({
        where: { email },
        data: { password: await bcrypt.hash(password, 12), role: 'ADMIN', active: true },
      });
      console.log(`[seed] Reset password and ensured ADMIN role for ${email}.`);
    } else {
      console.log(`[seed] Admin user ${email} already exists - left unchanged.`);
    }
  }
  console.log('[seed] Done.');
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
