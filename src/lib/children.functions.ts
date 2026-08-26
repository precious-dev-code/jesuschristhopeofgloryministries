import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Adds a new child (and their parent details) to the roster.
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

