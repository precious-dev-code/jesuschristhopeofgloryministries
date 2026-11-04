import { verifyPaystackSignature } from "./paystack.server";

type Rpc = (name: "confirm_gift" | "fail_gift", args: Record<string, string | number>) => PromiseLike<{ data: unknown; error: unknown }>;

export async function handlePaystackWebhook(request: Request, secret: string, rpc: Rpc): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!verifyPaystackSignature(raw, signature, secret)) return new Response("Invalid signature", { status: 401 });
  let event: unknown;
  try { event = JSON.parse(raw); } catch { return new Response("Invalid payload", { status: 400 }); }
  if (!event || typeof event !== "object") return new Response("Invalid payload", { status: 400 });
  const payload = event as { event?: unknown; data?: { reference?: unknown; amount?: unknown; currency?: unknown } };
  if (payload.event !== "charge.success" && payload.event !== "charge.failed") return Response.json({ received: true });
  const reference = payload.data?.reference;
  if (typeof reference !== "string" || !/^GG-[A-Za-z0-9\-.=]{5,97}$/.test(reference)) return Response.json({ received: true });
  let result: { data: unknown; error: unknown };
  try {
    if (payload.event === "charge.success") {
      const amount = payload.data?.amount;
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647 || payload.data?.currency !== "ZAR") {
        return new Response("Invalid payment amount or currency", { status: 400 });
      }
      result = await rpc("confirm_gift", { p_reference: reference, p_amount_cents: amount, p_currency: "ZAR", p_via: "paystack-webhook" });
    } else {
      result = await rpc("fail_gift", { p_reference: reference, p_via: "paystack-webhook" });
    }
  } catch {
    return new Response("Payment storage unavailable", { status: 503 });
  }
  // Never acknowledge a database failure: Paystack must be able to retry it.
  if (result.error || result.data == null) return new Response("Payment storage unavailable", { status: 503 });
  return Response.json({ received: true });
}
