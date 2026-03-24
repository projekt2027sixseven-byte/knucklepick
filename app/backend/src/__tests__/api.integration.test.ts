import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../createApp";
import { prisma } from "../prisma";

const app = createApp();

describe("API integration (sequential)", () => {
  const testEmail = `vitest-${Date.now()}@integration.test`;
  const password = "TestPassword123456!";
  let matchId: string;
  let userToken: string;

  beforeAll(async () => {
    const m = await prisma.match.findFirst({
      where: { predictions: { some: {} } },
      orderBy: { utcDate: "asc" },
      select: { id: true },
    });
    if (!m?.id) {
      throw new Error("No match with prediction in DB — run prisma db seed first.");
    }
    matchId = m.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("covers auth, matches, watchlist, picks, preferences, digest gate, billing, admin", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const caps = await request(app).get("/api/billing/capabilities");
    expect(caps.status).toBe(200);
    expect(caps.body).toHaveProperty("stripe");
    expect(caps.body).toHaveProperty("digestEmail");

    const dctx = await request(app).get("/api/meta/data-context");
    expect(dctx.status).toBe(200);
    expect(dctx.body).toHaveProperty("liveIntegrations");
    expect(dctx.body).toHaveProperty("mockDataMode");

    const perf = await request(app).get("/api/insights/performance");
    expect(perf.status).toBe(200);
    expect(perf.body).toHaveProperty("totalSettled");
    expect(perf.body).toHaveProperty("insufficientHistory");
    expect(perf.body).toHaveProperty("last50");
    expect(perf.body).toHaveProperty("last10");
    expect(perf.body).toHaveProperty("edgeVsOutcome");

    const reg = await request(app).post("/api/auth/register").send({
      email: testEmail,
      password,
      name: "Vitest User",
    });
    expect(reg.status).toBe(200);
    expect(reg.body.token).toBeTruthy();
    userToken = reg.body.token;

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${userToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(testEmail);
    expect(me.body).toHaveProperty("hasStripeCustomer");

    const login = await request(app).post("/api/auth/login").send({ email: testEmail, password });
    expect(login.status).toBe(200);

    const list = await request(app).get("/api/matches");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.matches)).toBe(true);

    const detail = await request(app).get(`/api/matches/${matchId}`).set("Authorization", `Bearer ${userToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.match).toBeTruthy();

    const wlPost = await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ matchId });
    expect(wlPost.status).toBe(200);

    const wlList = await request(app).get("/api/watchlist").set("Authorization", `Bearer ${userToken}`);
    expect(wlList.status).toBe(200);
    expect(wlList.body.items.some((x: { match: { id: string } }) => x.match.id === matchId)).toBe(true);

    const wlDel = await request(app).delete(`/api/watchlist/${matchId}`).set("Authorization", `Bearer ${userToken}`);
    expect(wlDel.status).toBe(200);

    const pickPost = await request(app)
      .post("/api/picks")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ matchId, label: "vitest" });
    expect(pickPost.status).toBe(200);
    const pickId = pickPost.body.pick.id as string;

    const pickList = await request(app).get("/api/picks").set("Authorization", `Bearer ${userToken}`);
    expect(pickList.status).toBe(200);
    expect(pickList.body.picks.some((p: { id: string }) => p.id === pickId)).toBe(true);

    const pickDel = await request(app).delete(`/api/picks/${pickId}`).set("Authorization", `Bearer ${userToken}`);
    expect(pickDel.status).toBe(200);

    const prefPut = await request(app)
      .put("/api/me/preferences")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ reducedMotion: true, onboardingStep: 1 });
    expect(prefPut.status).toBe(200);

    const prefGet = await request(app).get("/api/me/preferences").set("Authorization", `Bearer ${userToken}`);
    expect(prefGet.status).toBe(200);
    expect(prefGet.body.preferences.reducedMotion).toBe(true);

    const digest = await request(app).get("/api/digest/today").set("Authorization", `Bearer ${userToken}`);
    expect(digest.status).toBe(402);

    const portal = await request(app)
      .post("/api/billing/portal")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    expect([400, 503]).toContain(portal.status);

    const admin = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${userToken}`);
    expect(admin.status).toBe(403);

    const noAuth = await request(app).get("/api/auth/me");
    expect(noAuth.status).toBe(401);
  });
});
