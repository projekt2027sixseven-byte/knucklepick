import type { PrismaClient } from "@prisma/client";

const START_OF_DAY = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export type PlanEntitlements = {
  dailyMatchLimit: number;
  planSlug: string;
  watchlistLimit: number;
  savedPickLimit: number;
  digestEnabled: boolean;
  apiAccess: boolean;
};

export async function getUserPlanLimits(
  prisma: PrismaClient,
  userId: string
): Promise<PlanEntitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  const entitled =
    sub &&
    (sub.status === "ACTIVE" || sub.status === "TRIALING");

  if (!sub || !entitled) {
    return {
      dailyMatchLimit: 3,
      planSlug: "none",
      watchlistLimit: 8,
      savedPickLimit: 12,
      digestEnabled: false,
      apiAccess: false,
    };
  }
  const p = sub.plan;
  return {
    dailyMatchLimit: p.dailyMatchLimit,
    planSlug: p.slug,
    watchlistLimit: p.watchlistLimit,
    savedPickLimit: p.savedPickLimit,
    digestEnabled: p.digestEnabled,
    apiAccess: p.apiAccess,
  };
}

export async function countMatchViewsToday(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.usageLog.count({
    where: {
      userId,
      action: "MATCH_VIEW",
      createdAt: { gte: START_OF_DAY() },
    },
  });
}

export async function logMatchView(prisma: PrismaClient, userId: string, matchId: string): Promise<void> {
  await prisma.usageLog.create({
    data: { userId, action: "MATCH_VIEW", matchId },
  });
}

export function shouldLockPremium(dailyLimit: number, used: number): boolean {
  if (dailyLimit < 0) return false;
  return used >= dailyLimit;
}

export async function countWatchlist(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.watchlistItem.count({ where: { userId } });
}

export async function countSavedPicks(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.savedPick.count({ where: { userId } });
}
