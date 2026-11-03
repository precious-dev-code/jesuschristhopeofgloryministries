// Server-only Paystack helpers. Never import this from client code.
import { createHmac, timingSafeEqual } from "node:crypto";

export function paystackSignature(rawBody: string, secret: string) {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function verifyPaystackSignature(rawBody: string, signature: string, secret: string) {
  const expected = paystackSignature(rawBody, secret);
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}
