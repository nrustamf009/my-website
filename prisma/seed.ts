/**
 * One-command demo data: `npm run db:seed` (or `npm run setup`).
 * Everything here is fictional. Dates are relative to "now" so the demo never goes stale.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_BROKERS } from "../seed/brokers";
import { DEFAULT_FICO_LTV_CAPS } from "../lib/dscr";
import { DEFAULT_DISCLAIMER } from "../lib/broker";
import { seedModules } from "../seed/modules";

const prisma = new PrismaClient();

async function reset() {
  // Order matters for FK constraints.
  await prisma.$transaction([
    prisma.scenarioView.deleteMany(),
    prisma.scenarioOption.deleteMany(),
    prisma.scenario.deleteMany(),
    prisma.snapshotScan.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.snapshot.deleteMany(),
    prisma.realtor.deleteMany(),
    prisma.closedLoan.deleteMany(),
    prisma.loanImport.deleteMany(),
    prisma.callSession.deleteMany(),
    prisma.webhookDelivery.deleteMany(),
    prisma.devEmail.deleteMany(),
    prisma.rateLimitHit.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.broker.deleteMany(),
    prisma.agency.deleteMany(),
  ]);
}

async function main() {
  await reset();
  const agency = await prisma.agency.create({
    data: { name: "Northbeam Growth Partners", slug: "northbeam", accentColor: "#17150F" },
  });
  await prisma.user.create({ data: { email: "admin@northbeam.example", name: "Alex Rivera (Agency admin)", role: "AGENCY_ADMIN", agencyId: agency.id } });

  const brokers = [];
  for (const b of DEMO_BROKERS) {
    const { login, ...data } = b;
    brokers.push(
      await prisma.broker.create({
        data: {
          ...data,
          agencyId: agency.id,
          notificationEmail: data.email,
          webhookSecret: `whsec_demo_${data.slug.replace(/-/g, "")}`,
          disclaimerText: DEFAULT_DISCLAIMER,
          ficoLtvCaps: JSON.stringify(DEFAULT_FICO_LTV_CAPS),
          marketRateUpdatedAt: new Date(),
          users: { create: { email: login, name: data.name, role: "BROKER" } },
        },
      }),
    );
  }

  const summary = await seedModules(prisma, brokers);
  console.log("Seeded:", { agency: agency.name, brokers: brokers.length, ...summary });
  console.log("Sign in at http://localhost:3000/login (demo accounts are one click in dev).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
