import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const givingTypes = ["Tithe", "Offering", "Special Project"] as const;
export type GivingType = (typeof givingTypes)[number];
export const giftStatuses = ["Pending", "Paid", "Failed"] as const;
export type GiftStatus = (typeof giftStatuses)[number];
export type Gift = {
  id: string;
  date: string;
  amount: number;
  type: GivingType;
  status: GiftStatus;
  name: string;
  prayer: string;
};

// Giving records live in the church database. Each donor's browser holds a
// private device token; the database only returns rows that carry this
// device's token, so a donor never sees another donor's records.
const deviceKey = "glorygate-giving-device-v2";

export function getDeviceToken(): string {
  const stored = window.localStorage.getItem(deviceKey);
  if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) {
    return stored;
  }
  const token = crypto.randomUUID();
  window.localStorage.setItem(deviceKey, token);
  return token;
}

function givingClient(token: string) {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key) throw new Error("Giving records are unavailable right now.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "x-giving-device-token": token },
      // Opaque sb_ keys aren't JWTs; send only apikey, not a bearer.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function fetchGifts(): Promise<Gift[]> {
  const client = givingClient(getDeviceToken());
  const { data, error } = await client
    .from("gifts")
    .select("reference,amount_cents,gift_type,status,donor_name,prayer_request,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Giving history is unavailable right now.");
  return (data ?? [])
    .map((row) => ({
      id: row.reference,
      date: row.created_at,
      amount: row.amount_cents / 100,
      type: row.gift_type as GivingType,
      status: row.status as GiftStatus,
      name: row.donor_name ?? "",
      prayer: row.prayer_request ?? "",
    }))
    .filter((gift) => givingTypes.includes(gift.type) && giftStatuses.includes(gift.status));
}

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const rows = await fetchGifts();
        if (!cancelled) {
          setGifts(rows);
          setError("");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Giving history is unavailable right now.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void refresh();
    // Payments confirm server-side (Paystack webhook) — pick up status
    // changes made while this screen is open without any manual refresh.
    const interval = window.setInterval(refresh, 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("giving-updated", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("giving-updated", onFocus);
    };
  }, []);
  return { gifts, ready, error };
}

export function formatGiftAmount(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
}

export function giftDay(date: string) {
  const day = new Date(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}
