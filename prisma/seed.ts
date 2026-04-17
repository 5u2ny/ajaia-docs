/**
 * Seed 3 demo users so reviewers can log in immediately.
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { name: "Alex",   email: "alex@demo.app",   password: "password123" },
  { name: "Maya",   email: "maya@demo.app",   password: "password123" },
  { name: "Jordan", email: "jordan@demo.app", password: "password123" },
];

async function main() {
  console.log("Seeding demo users...");
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: { name: u.name, email: u.email, passwordHash },
    });
    console.log(`  ${user.name.padEnd(8)} ${user.email}`);
  }
  console.log("Done. All demo passwords: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
