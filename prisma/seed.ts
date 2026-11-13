/**
 * One-command demo data: `npm run db:seed` (or `npm run setup`). Everything is fictional.
 * Dates are relative to "now" so the demo never goes stale.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_BROKERS } from "../seed/brokers";
import { DEFAULT_DISCLAIMER } from "../lib/compliance/disclaimers";
import { ALL_FEATURES } from "../lib/broker";
import { seedModules } from "../seed/modules";

const prisma = new PrismaClient();

async function reset() {
  // Children first; Broker cascades the tenant tables.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.broker.deleteMany(),
    prisma.agency.deleteMany(),
    prisma.devEmail.deleteMany(),
    prisma.rateLimitHit.deleteMany(),
    prisma.propertyCache.deleteMany(),
  ]);
}

async function main() {
  await reset();
  const agency = await prisma.agency.create({ data: { name: "Northbeam Growth Partners", slug: "northbeam", accentColor: "#17150F" } });
  const admin = await prisma.user.create({ data: { email: "admin@northbeam.example", name: "Alex Rivera", role: "AGENCY_ADMIN", agencyId: agency.id } });

  const brokers = [];
  for (const d of DEMO_BROKERS) {
    const broker = await prisma.broker.create({
      data: {
        agencyId: agency.id,
        slug: d.slug,
        status: d.status,
        features: JSON.stringify(ALL_FEATURES),
        companyName: d.companyName,
        companyNmlsId: d.companyNmlsId,
        accentColor: d.accentColor,
        logoUrl: d.logoUrl,
        email: d.email,
        phone: d.phone,
        websiteUrl: d.websiteUrl,
        privacyPolicyUrl: d.privacyPolicyUrl,
        licensedStates: JSON.stringify(d.licensedStates),
        notificationEmails: JSON.stringify([d.users[0]!.email]),
        webhookSecret: `whsec_demo_${d.slug.replace(/-/g, "")}`,
        tonePreset: d.tonePreset,
        programGrid: JSON.stringify(d.programGrid),
        marketRateMilli: d.marketRateMilli,
        marketRateUpdatedAt: new Date(),
        onboardingStep: 6,
        isDemo: true,
      },
    });
    const users = [];
    for (const u of d.users) users.push(await prisma.user.create({ data: { ...u, brokerId: broker.id } }));
    const disc = await prisma.disclaimerVersion.create({ data: { brokerId: broker.id, version: 1, text: DEFAULT_DISCLAIMER } });
    await prisma.broker.update({ where: { id: broker.id }, data: { primaryUserId: users[0]!.id, currentDisclaimerId: disc.id } });
    brokers.push({ broker: await prisma.broker.findUniqueOrThrow({ where: { id: broker.id } }), users });
  }
  await prisma.auditLog.create({ data: { agencyId: agency.id, actorUserId: admin.id, action: "BROKER_CREATE", targetBrokerId: brokers[0]!.broker.id, meta: "{}" } });

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
