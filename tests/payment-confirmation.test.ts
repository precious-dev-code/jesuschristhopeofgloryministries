import { createHmac } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { confirmationStatus } from "../src/lib/payment-status";
import { handlePaystackWebhook } from "../src/lib/paystack-webhook.server";

const secret = "sk_test_local_only";
const event = { event: "charge.success", data: { reference: "GG-12345678", amount: 5000, currency: "ZAR" } };
function request(payload: unknown = event, signature?: string) {
  const body = JSON.stringify(payload);
  return new Request("https://example.com/api/public/paystack/webhook", { method: "POST", body, headers: { "x-paystack-signature": signature ?? createHmac("sha512", secret).update(body).digest("hex") } });
}
describe("stored payment confirmation", () => {
  it.each(["Paid", "Already"])("recognises a stored confirmation: %s", value => expect(confirmationStatus(value)).toBe("Paid"));
  it.each([null, undefined, "Unknown", "Mismatch", "Failed", "unexpected"])("never reports Paid for %s", value => expect(confirmationStatus(value)).toBe("Pending"));
});
describe("webhook delivery", () => {
  it("rejects forged signatures without touching storage", async () => {
    const rpc = vi.fn();
    expect((await handlePaystackWebhook(request(event, "forged"), secret, rpc)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns retryable failure when the database fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await handlePaystackWebhook(request(), secret, rpc)).status).toBe(503);
  });
  it("returns retryable failure on thrown storage errors", async () => {
    expect((await handlePaystackWebhook(request(), secret, vi.fn().mockRejectedValue(new Error("offline")))).status).toBe(503);
  });
  it.each(["Paid", "Already"])("acknowledges persisted confirmation %s", async value => {
    const rpc = vi.fn().mockResolvedValue({ data: value, error: null });
    expect((await handlePaystackWebhook(request(), secret, rpc)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("confirm_gift", { p_reference: "GG-12345678", p_amount_cents: 5000, p_currency: "ZAR", p_via: "paystack-webhook" });
  });
  it.each([5000.1, 0, -1, 2147483648])("does not round or store invalid minor units %s", async amount => {
    const rpc = vi.fn();
    expect((await handlePaystackWebhook(request({ ...event, data: { ...event.data, amount } }), secret, rpc)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects signed null payloads", async () => expect((await handlePaystackWebhook(request(null), secret, vi.fn())).status).toBe(400));
  it("acknowledges unrelated events without changing storage", async () => {
    const rpc = vi.fn();
    expect((await handlePaystackWebhook(request({ event: "other" }), secret, rpc)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
});
