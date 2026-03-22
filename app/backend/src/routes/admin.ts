import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware";
import { ingestAndPredict } from "../../../services/predictionPipeline";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { subscription: { include: { plan: true } } },
  });
  res.json({ users });
});

router.patch("/users/:id/role", async (req, res) => {
  const body = z.object({ role: z.enum(["USER", "ADMIN"]) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
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
