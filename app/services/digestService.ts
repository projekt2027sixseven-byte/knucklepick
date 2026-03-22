import type { PrismaClient } from "@prisma/client";

export type DigestFixture = {
  matchId: string;
  kickoff: string;
  home: string;
  away: string;
  league?: string | null;
  headline: string;
  trustIndex: number;
  valueScore: number;
};

export async function buildDailyDigest(prisma: PrismaClient): Promise<{
  generatedAt: string;
  fixtures: DigestFixture[];
}> {
  const horizon = new Date(Date.now() + 36 * 3600000);
  const matches = await prisma.match.findMany({
    where: { utcDate: { gte: new Date(), lte: horizon }, status: { not: "FT" } },
    orderBy: { utcDate: "asc" },
    take: 80,
    include: {
      homeTeam: true,
      awayTeam: true,
      league: true,
      predictions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const fixtures: DigestFixture[] = [];
  for (const m of matches) {
    const p = m.predictions[0];
    if (!p || p.noBet) continue;
    fixtures.push({
      matchId: m.id,
      kickoff: m.utcDate.toISOString(),
      home: m.homeTeam.name,
      away: m.awayTeam.name,
      league: m.league?.name,
      headline: `${p.outcomePrediction} · ${p.exactScore} · trust ${p.trustIndex.toFixed(0)}`,
      trustIndex: p.trustIndex,
      valueScore: p.valueScore,
    });
  }

  fixtures.sort((a, b) => b.trustIndex - a.trustIndex || b.valueScore - a.valueScore);

  return {
    generatedAt: new Date().toISOString(),
    fixtures: fixtures.slice(0, 8),
  };
}
