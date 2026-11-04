import { createFileRoute } from "@tanstack/react-router";
import { handlePaystackWebhook } from "@/lib/paystack-webhook.server";

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Payments are not configured.", { status: 503 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return await handlePaystackWebhook(request, secret, (name, args) => supabaseAdmin.rpc(name, args as never));
        } catch {
          return new Response("Payment storage unavailable", { status: 503 });
        }
      },
    },
  },
});
