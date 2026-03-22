import { Router } from "express";
import type { SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";
import { z } from "zod";
import { loadEnv } from "../../../config/env";
import { prisma } from "../prisma";
import type { AuthedRequest } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/authMiddleware";
import { log } from "../lib/logger";

const router = Router();

function getStripe(): Stripe | null {
  try {
    const key = loadEnv().STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key);
  } catch {
    return null;
  }
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "INCOMPLETE";
    default:
      return "ACTIVE";
  }
}

async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    log.warn("stripe_webhook_no_user_for_customer", { customerId });
    return;
  }

  const priceId = sub.items.data[0]?.price.id;
  let plan =
    priceId != null
      ? await prisma.plan.findFirst({ where: { stripePriceId: priceId } })
      : null;
  const metaSlug = sub.metadata?.planSlug;
  if (!plan && metaSlug) {
    plan = await prisma.plan.findUnique({ where: { slug: metaSlug } });
  }
  if (!plan) {
    plan = await prisma.plan.findUnique({ where: { slug: "starter" } });
  }
  if (!plan) {
    log.warn("stripe_webhook_no_plan_fallback", { userId: user.id });
    return;
  }

  const status = mapStripeSubscriptionStatus(sub.status);
  const periodEnd =
    typeof sub.current_period_end === "number" ? new Date(sub.current_period_end * 1000) : null;

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planId: plan.id,
      status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planId: plan.id,
      status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd,
    },
  });
}

router.post("/checkout", requireAuth, async (req: AuthedRequest, res) => {
  const stripe = getStripe();
  const env = loadEnv();
  const body = z.object({ planSlug: z.enum(["starter", "pro", "ultimate"]) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }
  const priceMap: Record<string, string | undefined> = {
    starter: env.STRIPE_PRICE_STARTER,
    pro: env.STRIPE_PRICE_PRO,
    ultimate: env.STRIPE_PRICE_ULTIMATE,
  };
  const priceId = priceMap[body.data.planSlug];
  if (!priceId) {
    res.status(503).json({ error: "Stripe price IDs not configured for this plan" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name ?? undefined });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.FRONTEND_URL}/account?checkout=success`,
    cancel_url: `${env.FRONTEND_URL}/pricing?checkout=cancel`,
    metadata: { userId: user.id, planSlug: body.data.planSlug },
    subscription_data: {
      metadata: { userId: user.id, planSlug: body.data.planSlug },
    },
  });
  res.json({ url: session.url });
});

export default router;

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined
): Promise<{ received: boolean; error?: string }> {
  const env = loadEnv();
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return { received: false, error: "Stripe webhook not configured" };
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { received: false, error: String(err) };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planSlug = session.metadata?.planSlug;
        if (userId && planSlug) {
          const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
          if (plan) {
            await prisma.subscription.upsert({
              where: { userId },
              create: {
                userId,
                planId: plan.id,
                status: "ACTIVE",
                stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              },
              update: {
                planId: plan.id,
                status: "ACTIVE",
                stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              },
            });
          }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
          await prisma.subscription.updateMany({
            where: { userId: user.id },
            data: { status: "CANCELED", stripeSubscriptionId: null },
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef && typeof subRef === "object" ? subRef.id : null;
        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }
      default:
        log.debug("stripe_webhook_unhandled", { type: event.type });
    }
  } catch (e) {
    log.error("stripe_webhook_handler_failed", { type: event.type, err: String(e) });
    return { received: false, error: "Webhook handler failed" };
  }

  return { received: true };
}
