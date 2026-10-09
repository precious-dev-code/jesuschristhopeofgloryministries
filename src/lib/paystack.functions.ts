import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const referenceSchema = z.string().regex(/^[A-Za-z0-9\-.=]{8,100}$/);

export const initializePayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      amount: z.number().positive().max(100000000),
      email: z.string().trim().email().max(255),
      type: z.enum(["Tithe", "Offering", "Special Project"]),
      name: z.string().trim().max(150),
      reference: referenceSchema,
      callbackUrl: z.string().url().max(500),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured yet.");
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        amount: Math.round(data.amount * 100),
        currency: "ZAR",
        reference: data.reference,
        callback_url: data.callbackUrl,
        metadata: { giftType: data.type, giverName: data.name },
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string } }
      | null;
    if (!response.ok || !body?.status || !body.data?.authorization_url) {
      console.error(`Paystack initialize failed [${response.status}]: ${JSON.stringify(body)}`);
      throw new Error(body?.message ?? "Paystack could not start this payment.");
    }
    return { authorizationUrl: body.data.authorization_url };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reference: referenceSchema }).parse(data))
  .handler(async ({ data }) => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured yet.");
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const body = (await response.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { status?: string } }
      | null;
    if (!response.ok || !body?.status) {
      console.error(`Paystack verify failed [${response.status}]: ${JSON.stringify(body)}`);
      throw new Error(body?.message ?? "Paystack could not confirm this payment.");
    }
    const state = body.data?.status;
    const status: "Paid" | "Failed" | "Pending" =
      state === "success" ? "Paid" : state === "failed" || state === "abandoned" || state === "reversed" ? "Failed" : "Pending";
    return { status };
  });
