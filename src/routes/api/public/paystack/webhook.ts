import { createFileRoute } from "@tanstack/react-router";
import { verifyPaystackSignature } from "@/lib/paystack.server";

// Paystack webhook. External caller — the /api/public prefix bypasses site
// auth, so the handler verifies the HMAC-SHA512 signature over the raw body
// before touching anything. Status changes are idempotent: redeliveries and
// duplicate events can never create or re-confirm a gift.
export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Payments are not configured.", { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        if (!signature || !verifyPaystackSignature(raw, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          event?: string;
          data?: { reference?: string; amount?: number; currency?: string };
        };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const reference = event.data?.reference;

        if (event.event === "charge.success" && reference) {
          const amount = typeof event.data?.amount === "number" ? Math.round(event.data.amount) : NaN;
          const currency = event.data?.currency ?? "";
          if (!Number.isSafeInteger(amount) || !currency) {
            console.error(`Paystack webhook charge.success ${reference}: missing amount/currency`);
            return Response.json({ received: true });
          }
          const { data: result, error } = await supabaseAdmin.rpc("confirm_gift", {
            p_reference: reference,
            p_amount_cents: amount,
            p_currency: currency,
            p_via: "paystack-webhook",
          });
          if (error) console.error(`confirm_gift error for ${reference}: ${error.message}`);
          else console.log(`paystack webhook charge.success ${reference} -> ${result}`);
        } else if (event.event === "charge.failed" && reference) {
          const { data: result, error } = await supabaseAdmin.rpc("fail_gift", {
            p_reference: reference,
            p_via: "paystack-webhook",
          });
          if (error) console.error(`fail_gift error for ${reference}: ${error.message}`);
          else console.log(`paystack webhook charge.failed ${reference} -> ${result}`);
        }
        // Any other event type is acknowledged so Paystack stops retrying.
        return Response.json({ received: true });
      },
    },
  },
});
