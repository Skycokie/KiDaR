import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getLoggedInUser } from "@/lib/appwrite/client";
import { getProfile, updateProfileDocument } from "@/lib/appwrite/db";
import { creditsPerStripePack } from "@/lib/credits";

function stripeClient(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) return null;
  // apiVersion follows the installed stripe package default.
  return new Stripe(key);
}

/**
 * Start Stripe Checkout for one Tripo credit pack.
 * Requires STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_CREDITS_PER_PACK, NEXT_PUBLIC_APP_URL.
 */
export async function POST() {
  const user = await getLoggedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = stripeClient();
  const priceId = (process.env.STRIPE_PRICE_ID ?? "").trim();
  const pack = creditsPerStripePack();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!stripe || !priceId || !pack || !appUrl) {
    return NextResponse.json(
      {
        error: "billing_unconfigured",
        message: "Stripe Checkout is not configured."
      },
      { status: 503 }
    );
  }

  try {
    let profile = await getProfile(user.$id);
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { appwrite_user_id: user.$id }
      });
      customerId = customer.id;
      profile = await updateProfileDocument(user.$id, { stripe_customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/studio-preview?checkout=success`,
      cancel_url: `${appUrl}/studio-preview?checkout=cancel`,
      metadata: {
        appwrite_user_id: user.$id,
        credits: String(pack)
      },
      payment_intent_data: {
        metadata: {
          appwrite_user_id: user.$id,
          credits: String(pack)
        }
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: "checkout_session_missing_url" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
