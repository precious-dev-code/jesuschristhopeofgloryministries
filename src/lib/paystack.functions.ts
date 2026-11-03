import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const referenceSchema = z.string().regex(/^[A-Za-z0-9\-.=]{8,100}$/);

const paymentInput = z.object({
  amount: z.number().positive().max(100000000),
  email: z.string().trim().email().max(255),
  type: z.enum(["Tithe", "Offering", "Special Project"]),
  name: z.string().trim().max(150),
  prayer: z.string().trim().max(2000),
  deviceToken: z.string().uuid(),
  callbackUrl: z.string().url().max(500),
});

async function paystackAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Creates the Pending gift record in the database BEFORE checkout starts, then
// asks Paystack for a secure checkout URL. Amount and gift type are validated
// here on the server; the browser never creates or finalizes records.
export const initializePayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => paymentInput.parse(data))
  .handler(async ({ data }) => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured yet.");
    const supabaseAdmin = await paystackAdmin();
    const reference = `GG-${randomUUID().toUpperCase()}`;
    const amountCents = Math.round(data.amount * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error("Enter a valid amount greater than zero.");
    }

    const inserted = await supabaseAdmin
      .from("gifts")
      .insert({
        reference,
        device_token: data.deviceToken,
        donor_email: data.email,
        donor_name: data.name || null,
        prayer_request: data.prayer || null,
        gift_type: data.type,
        amount_cents: amountCents,
        currency: "ZAR",
        status: "Pending",
      })
      .select("id")
      .single();
    if (inserted.error) throw new Error("Your gift could not be recorded. Please try again.");

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        amount: amountCents,
        currency: "ZAR",
        reference,
        callback_url: data.callbackUrl,
        metadata: { giftType: data.type, giverName: data.name },
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string } }
      | null;
    if (!response.ok || !body?.status || !body.data?.authorization_url) {
      console.error(`Paystack initialize failed [${response.status}]: ${JSON.stringify(body)}`);
      await supabaseAdmin
        .from("gifts")
        .update({ status: "Failed", confirmed_via: "initialize-error" })
        .eq("reference", reference)
        .eq("status", "Pending");
      throw new Error(body?.message ?? "Paystack could not start this payment.");
    }
    return { authorizationUrl: body.data.authorization_url };
  });

// Return-visit verification. The donor's browser only learns the outcome —
// the record change happens here, and the Paystack webhook remains the
// source of truth when the donor never returns.
export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reference: referenceSchema }).parse(data))
  .handler(async ({ data }) => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured yet.");
    const supabaseAdmin = await paystackAdmin();

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const body = (await response.json().catch(() => null)) as
      | {
          status?: boolean;
          message?: string;
          data?: { status?: string; amount?: number; currency?: string };
        }
      | null;
    if (!response.ok || !body?.status) {
      console.error(`Paystack verify failed [${response.status}]: ${JSON.stringify(body)}`);
      throw new Error(body?.message ?? "Paystack could not confirm this payment.");
    }

    const state = body.data?.status;
    if (state === "success") {
      const amount = typeof body.data?.amount === "number" ? Math.round(body.data.amount) : NaN;
      const currency = body.data?.currency ?? "";
      const result = Number.isSafeInteger(amount) && currency
        ? (await supabaseAdmin.rpc("confirm_gift", {
            p_reference: data.reference,
            p_amount_cents: amount,
            p_currency: currency,
            p_via: "return-verify",
          })).data
        : "Mismatch";
      if (result === "Mismatch") {
        console.error(`Paystack verify amount/currency mismatch for ${data.reference}`);
        return { status: "Pending" as const };
      }
      return { status: "Paid" as const };
    }
    if (state === "failed" || state === "abandoned" || state === "reversed") {
      await supabaseAdmin.rpc("fail_gift", { p_reference: data.reference, p_via: "return-verify" });
      return { status: "Failed" as const };
    }
    return { status: "Pending" as const };
  });
