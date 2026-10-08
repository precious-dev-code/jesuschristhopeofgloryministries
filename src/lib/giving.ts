import { useEffect, useState } from "react";

export const givingTypes = ["Tithe", "Offering", "Special Project"] as const;
export type GivingType = (typeof givingTypes)[number];
export type Gift = {
  id: string;
  date: string;
  amount: number;
  type: GivingType;
  status: "Pending";
  name: string;
  prayer: string;
};
const storageKey = "glorygate-giving-drafts-v1";

export function readGifts(): Gift[] {
  const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
  if (!Array.isArray(value)) throw new Error("Giving history could not be read.");
  return value.filter((gift): gift is Gift =>
    typeof gift === "object" && gift !== null &&
    typeof gift.id === "string" && typeof gift.date === "string" &&
    Number.isFinite(Date.parse(gift.date)) &&
    typeof gift.amount === "number" && Number.isFinite(gift.amount) && gift.amount > 0 &&
    givingTypes.includes(gift.type) && gift.status === "Pending" &&
    typeof gift.name === "string" && typeof gift.prayer === "string",
  );
}

export function saveGift(input: Pick<Gift, "amount" | "type" | "name" | "prayer">) {
  const gift: Gift = { ...input, id: crypto.randomUUID(), date: new Date().toISOString(), status: "Pending" };
  window.localStorage.setItem(storageKey, JSON.stringify([gift, ...readGifts()]));
  window.dispatchEvent(new Event("giving-updated"));
  return gift;
}

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try { setGifts(readGifts()); setError(""); }
      catch { setError("Giving history is unavailable on this device."); }
      setReady(true);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("giving-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("giving-updated", refresh);
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