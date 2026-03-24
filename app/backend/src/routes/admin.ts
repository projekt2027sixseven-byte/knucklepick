import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware";
import { ingestAndPredict } from "../../../services/predictionPipeline";
import { cacheDel } from "../../../utils/cache";
import { parseResourceId } from "../validation/ids";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res) => {
  const [users, matches, predictions, subs, lastLog] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
    prisma.prediction.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.adminLog.findFirst({ orderBy: { createdAt: "desc" }, where: { action: "PIPELINE_RUN" } }),
  ]);
  const maintenance = await prisma.appConfig.findUnique({ where: { key: "MAINTENANCE_MODE" } });
  res.json({
    counts: { users, matches, predictions, activeSubscriptions: subs },
    lastPipelineRun: lastLog?.createdAt ?? null,
    lastPipelineResult: lastLog?.payload ?? null,
    maintenanceMode: maintenance?.value === "true",
  });
});

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { subscription: { include: { plan: true } } },
  });
  res.json({ users });
});

router.patch("/users/:id/role", async (req, res) => {
  const idParsed = parseResourceId(req.params.id);
  if (!idParsed.ok) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const body = z.object({ role: z.enum(["USER", "ADMIN"]) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const adminId = (req as AuthedRequest).user?.id;
  if (adminId && adminId === idParsed.id && body.data.role === "USER") {
    res.status(400).json({ error: "You cannot remove your own admin role from this UI." });
    return;
  }
  const user = await prisma.user.update({
    where: { id: idParsed.id },
    data: { role: body.data.role },
  });
  await prisma.adminLog.create({
    data: {
      adminId: (req as AuthedRequest).user?.id,
      action: "USER_ROLE_CHANGE",
      payload: { userId: user.id, role: body.data.role },
    },
  });
  res.json({ user });
});

router.get("/weights", async (_req, res) => {
  const rows = await prisma.engineWeight.findMany();
  res.json({ weights: rows });
});

router.put("/weights", async (req, res) => {
  const body = z.record(z.string(), z.number()).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const entries = Object.entries(body.data);
  for (const [key, value] of entries) {
    await prisma.engineWeight.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  await prisma.adminLog.create({
    data: {
      adminId: (req as AuthedRequest).user?.id,
      action: "WEIGHTS_UPDATE",
      payload: body.data,
    },
  });
  res.json({ ok: true });
});

router.get("/config", async (_req, res) => {
  const rows = await prisma.appConfig.findMany();
  res.json({
    config: rows.map((r) => ({
      key: r.key,
      value: r.isSecret ? "***" : r.value,
      isSecret: r.isSecret,
    })),
  });
});

router.put("/config", async (req, res) => {
  const body = z
    .object({
      key: z.string(),
      value: z.string(),
      isSecret: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const row = await prisma.appConfig.upsert({
    where: { key: body.data.key },
    create: {
      key: body.data.key,
      value: body.data.value,
      isSecret: body.data.isSecret ?? false,
    },
    update: { value: body.data.value, isSecret: body.data.isSecret ?? false },
  });
  await prisma.adminLog.create({
    data: {
      adminId: (req as AuthedRequest).user?.id,
      action: "CONFIG_UPDATE",
      payload: { key: row.key },
    },
  });
  res.json({ ok: true });
});

router.get("/logs", async (_req, res) => {
  const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ logs });
});

router.post("/pipeline/run", async (req: AuthedRequest, res) => {
  const result = await ingestAndPredict(prisma);
  await cacheDel("meta:leagues:v1").catch(() => undefined);
  await prisma.adminLog.create({
    data: {
      adminId: req.user?.id,
      action: "PIPELINE_RUN",
      payload: result as object,
    },
  });
  res.json(result);
});

export default router;
