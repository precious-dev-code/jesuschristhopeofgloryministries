import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaffAccess, canonicalRelationship, familyError, relationshipInput } from "./family";

export const getFamilyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_family_access");
    if (error) throw new Error("Could not check staff access. Please try again.");
    return { allowed: data === true };
  });

export const getFamilyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await context.supabase.rpc("has_family_access");
    assertStaffAccess(!access.error && access.data === true);
    const [members, links] = await Promise.all([
      context.supabase.from("members").select("id,member_name,phone").order("member_name"),
      context.supabase.from("family_relationships").select("id,member_a,member_b,role_a,role_b,version"),
    ]);
    if (members.error || links.error) throw new Error("Could not load families. Please try again.");
    return { members: members.data, links: links.data };
  });

export const saveFamilyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => relationshipInput.parse(input))
  .handler(async ({ data, context }) => {
    const access = await context.supabase.rpc("has_family_access");
    assertStaffAccess(!access.error && access.data === true);
    const canonical = canonicalRelationship(data);
    const result = data.id
      ? await context.supabase.from("family_relationships").update(canonical).eq("id", data.id).eq("version", data.version ?? 0).select("id").maybeSingle()
      : await context.supabase.from("family_relationships").insert(canonical).select("id").single();
    if (result.error) throw new Error(familyError(result.error));
    if (!result.data) throw new Error("This link was changed or removed by another staff member. Refresh before editing.");
    return { id: result.data.id };
  });

export const removeFamilyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), version: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await context.supabase.rpc("has_family_access");
    assertStaffAccess(!access.error && access.data === true);
    const result = await context.supabase.from("family_relationships").delete().eq("id", data.id).eq("version", data.version).select("id").maybeSingle();
    if (result.error) throw new Error(familyError(result.error));
    if (!result.data) throw new Error("This link was changed or removed by another staff member. Refresh and try again.");
    return { ok: true };
  });