import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { giftStatuses, givingTypes, type Gift, type GiftStatus, type GivingType } from "@/lib/giving";

// Church-wide giving history for approved finance/admin users (owner/staff in
// user_roles, assigned out-of-band — never through public signup). The
// database policy (has_giving_access) is the real gate; this keeps the UI honest.
export const getFinanceGifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("has_giving_access");
    if (allowed !== true) return { allowed: false, gifts: [] as Gift[] };
    const { data: rows, error } = await context.supabase
      .from("gifts")
      .select("reference,amount_cents,gift_type,status,donor_name,prayer_request,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Church-wide giving history is unavailable right now.");
    const gifts: Gift[] = (rows ?? [])
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
    return { allowed: true, gifts };
  });
