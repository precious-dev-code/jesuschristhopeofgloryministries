import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server function that records a Check In / Check Out action for a child.
 *
 * It:
 *  1. Loads the child's details from the database (service role).
 *  2. Updates the child's status + last action time.
 *  3. Appends an entry to the check-in activity log.
 *  4. Fires a POST request to the Make.com webhook with the full payload.
 *
 * The webhook call is done server-side because browser fetches to Make.com with
 * `Content-Type: application/json` are blocked by CORS preflight.
 */

const recordCheckAction = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        childId: z.string().uuid(),
        actionType: z.enum(["Check In", "Check Out"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load the child so the webhook payload carries the full details.
    const { data: child, error: loadError } = await supabaseAdmin
      .from("children")
      .select("id, child_name, parent_name, parent_phone")
      .eq("id", data.childId)
      .maybeSingle();

    if (loadError) {
      throw new Error(`Failed to load child: ${loadError.message}`);
    }
    if (!child) {
      throw new Error("Child not found");
    }

    const timestamp = new Date().toISOString();
    const newStatus = data.actionType === "Check In" ? "checked_in" : "checked_out";

    // 2. Update the child's current status.
    const { error: updateError } = await supabaseAdmin
      .from("children")
      .update({ status: newStatus, last_action_at: timestamp })
      .eq("id", data.childId);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // 3. Append to the activity log.
    const { error: logError } = await supabaseAdmin
      .from("check_in_logs")
      .insert({ child_id: data.childId, action_type: data.actionType });

    if (logError) {
      console.error("Failed to write check-in log:", logError.message);
      // Non-fatal — the status update already succeeded.
    }

    // 4. Fire the Make.com webhook. The URL is kept inside the handler so it
    //    never ships to the client bundle. Override via MAKE_WEBHOOK_URL env.
    const webhookUrl =
      process.env["MAKE_WEBHOOK_URL"] ??
      "https://hook.eu1.make.com/e6wgowgxjcqbwujwuuep2hqbkrslsxfo";

    const payload = {
      childId: child.id,
      childName: child.child_name,
      parentName: child.parent_name,
      parentPhone: child.parent_phone,
      actionType: data.actionType,
      timestamp,
    };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error(
          `Make.com webhook returned ${res.status}: ${await res.text()}`,
        );
      }
    } catch (err) {
      // Webhook delivery failures shouldn't block the user's check-in.
      console.error("Make.com webhook request failed:", err);
    }

    return { ok: true, childId: data.childId, status: newStatus, timestamp };
  });

export { recordCheckAction };
