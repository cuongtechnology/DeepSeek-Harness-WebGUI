/**
 * Seed script: creates an initial administrator account. Credentials come from
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (or fall back to insecure defaults
 * that MUST be changed). Run with `pnpm db:seed`.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@deepseek-harness/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme';
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin user ${email} already exists — skipping.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      name,
      role: 'admin',
    },
  });
  console.log(`[seed] Created admin user ${email}.`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
