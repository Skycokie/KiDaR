import { NextResponse } from "next/server";
import Stripe from "stripe";
import { creditCredits, ensureProfile, updateProfileDocument } from "@/lib/appwrite/db";
import { creditsPerStripePack } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeClient(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Stripe webhook — raw body required for signature verification.
 * Grants Tripo credits on checkout.session.completed.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "billing_unconfigured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "invalid_signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      (typeof session.metadata?.appwrite_user_id === "string" &&
        session.metadata.appwrite_user_id.trim()) ||
      null;
    const metaCredits = Number(session.metadata?.credits ?? "");
    const pack = Number.isInteger(metaCredits) && metaCredits > 0 ? metaCredits : creditsPerStripePack();
    if (!userId || !pack) {
      return NextResponse.json({ error: "missing_credit_metadata" }, { status: 400 });
    }

    const profile = await ensureProfile(userId);
    if (session.customer && typeof session.customer === "string") {
      if (profile.stripe_customer_id !== session.customer) {
        await updateProfileDocument(userId, { stripe_customer_id: session.customer });
      }
    }
    // Idempotency: Stripe may retry. Use session id stamp on profile via credits
    // only once per session by checking a simple marker in stripe metadata is not
    // stored on profile — grant is additive; ops should use Stripe idempotent events.
    // For a first ship we grant once per delivered event; Stripe retries with same
    // event id, and we do not persist event ids yet. Document for follow-up.
    await creditCredits(userId, pack);
  }

  return NextResponse.json({ received: true });
}
