import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { applyDirectUrlToProcessEnv } from "../../config/env";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
applyDirectUrlToProcessEnv();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  console.error(
    "[seed] Refusing to run in NODE_ENV=production. Set ALLOW_SEED=true intentionally if you need a one-off seed."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.createMany({
    data: [
      {
        slug: "starter",
        name: "Starter",
        dailyMatchLimit: 5,
        watchlistLimit: 25,
        savedPickLimit: 40,
        digestEnabled: false,
        apiAccess: false,
      },
      {
        slug: "pro",
        name: "Pro",
        dailyMatchLimit: 20,
        watchlistLimit: 80,
        savedPickLimit: 160,
        digestEnabled: true,
        apiAccess: false,
      },
      {
        slug: "ultimate",
        name: "Ultimate",
        dailyMatchLimit: -1,
        watchlistLimit: -1,
        savedPickLimit: -1,
        digestEnabled: true,
        apiAccess: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.plan.updateMany({
    where: { slug: "starter" },
    data: { watchlistLimit: 25, savedPickLimit: 40, digestEnabled: false, apiAccess: false },
  });
  await prisma.plan.updateMany({
    where: { slug: "pro" },
    data: { watchlistLimit: 80, savedPickLimit: 160, digestEnabled: true, apiAccess: false },
  });
  await prisma.plan.updateMany({
    where: { slug: "ultimate" },
    data: { watchlistLimit: -1, savedPickLimit: -1, digestEnabled: true, apiAccess: true },
  });

  const defaults: Record<string, number> = {
    weight_form: 0.22,
    weight_xg: 0.28,
    weight_odds: 0.2,
    weight_defense: 0.18,
    weight_similarity: 0.22,
    weight_market: 0.2,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.engineWeight.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  const adminEmail = "admin@matchoracle.local";
  const adminPass = "Admin12345678!";
  const hash = await bcrypt.hash(adminPass, 12);
  const starter = await prisma.plan.findUniqueOrThrow({ where: { slug: "starter" } });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: hash,
      name: "Platform Admin",
      role: "ADMIN",
    },
    update: { passwordHash: hash, role: "ADMIN" },
  });
  await prisma.subscription.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, planId: starter.id, status: "ACTIVE" },
    update: { planId: starter.id, status: "ACTIVE" },
  });
  await prisma.userPreferences.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, onboardingCompletedAt: new Date(), onboardingStep: 5 },
    update: {},
  });

  const league = await prisma.league.upsert({
    where: { externalId: "seed_league" },
    create: { externalId: "seed_league", name: "Seed League", country: "Testland" },
    update: {},
  });

  for (let i = 0; i < 18; i++) {
    const home = await prisma.team.upsert({
      where: { externalId: `seed_home_${i}` },
      create: {
        externalId: `seed_home_${i}`,
        name: `Seed Home ${i}`,
        leagueId: league.id,
      },
      update: {},
    });
    const away = await prisma.team.upsert({
      where: { externalId: `seed_away_${i}` },
      create: {
        externalId: `seed_away_${i}`,
        name: `Seed Away ${i}`,
        leagueId: league.id,
      },
      update: {},
    });
    const m = await prisma.match.upsert({
      where: { externalId: `seed_hist_${i}` },
      create: {
        externalId: `seed_hist_${i}`,
        utcDate: new Date(Date.now() - (i + 3) * 86400000),
        status: "FT",
        homeTeamId: home.id,
        awayTeamId: away.id,
        leagueId: league.id,
        homeScore: i % 3,
        awayScore: (i + 1) % 3,
      },
      update: {
        homeScore: i % 3,
        awayScore: (i + 1) % 3,
        status: "FT",
      },
    });
    await prisma.odds.create({
      data: {
        matchId: m.id,
        bookmaker: "seed",
        homeOdds: 1.8 + (i % 5) * 0.15,
        drawOdds: 3.2 + (i % 4) * 0.1,
        awayOdds: 3.5 + (i % 6) * 0.12,
      },
    });
  }

  console.log("Seed complete. Admin:", adminEmail, "/", adminPass);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
