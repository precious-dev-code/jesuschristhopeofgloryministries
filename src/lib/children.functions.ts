import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Roster management for children.
 * Writes go through the service role because the kiosk is unauthenticated.
 */
export const addChild = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        childName: z.string().trim().min(2).max(120),
        parentName: z.string().trim().min(2).max(120),
        parentPhone: z.string().trim().min(6).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: child, error } = await supabaseAdmin
      .from("children")
      .insert({
        child_name: data.childName,
        parent_name: data.parentName,
        parent_phone: data.parentPhone,
        status: "checked_out",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to add child: ${error.message}`);
    }

    return child;
  });

export const updateChild = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        childId: z.string().uuid(),
        childName: z.string().trim().min(2).max(120),
        parentName: z.string().trim().min(2).max(120),
        parentPhone: z.string().trim().min(6).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: child, error } = await supabaseAdmin
      .from("children")
      .update({
        child_name: data.childName,
        parent_name: data.parentName,
        parent_phone: data.parentPhone,
      })
      .eq("id", data.childId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update child: ${error.message}`);
    }

    return child;
  });

export const deleteChild = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ childId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Remove history first so the foreign key does not block the delete.
    await supabaseAdmin.from("check_in_logs").delete().eq("child_id", data.childId);

    const { error } = await supabaseAdmin
      .from("children")
      .delete()
      .eq("id", data.childId);

    if (error) {
      throw new Error(`Failed to remove child: ${error.message}`);
    }

    return { ok: true, childId: data.childId };
  });
