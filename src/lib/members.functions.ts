import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Member Attendance server functions.
 *
 * - addMember: registers a member (name + phone) via the service role
 *   (the kiosk is unauthenticated).
 * - markAttendance: records Present/Absent for a member and fires the
 *   Make.com webhook server-side (browser fetches to Make.com are CORS-blocked).
 */

export const addMember = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        memberName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: member, error } = await supabaseAdmin
      .from("members")
      .insert({
        member_name: data.memberName,
        phone: data.phone || null,
        status: "unmarked",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to add member: ${error.message}`);
    }

    return member;
  });

export const updateMember = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        memberId: z.string().uuid(),
        memberName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: member, error } = await supabaseAdmin
      .from("members")
      .update({ member_name: data.memberName, phone: data.phone || null })
      .eq("id", data.memberId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update member: ${error.message}`);
    }

    return member;
  });

export const deleteMember = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error } = await supabaseAdmin
      .from("members")
      .delete()
      .eq("id", data.memberId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }

    return { ok: true, memberId: data.memberId };
  });

export const markAttendance = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        memberId: z.string().uuid(),
        status: z.enum(["Present", "Absent"]),
        // Local calendar day of the kiosk (YYYY-MM-DD); defaults to UTC today.
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Load the member so the webhook payload carries the full details.
    const { data: member, error: loadError } = await supabaseAdmin
      .from("members")
      .select("id, member_name, phone")
      .eq("id", data.memberId)
      .maybeSingle();

    if (loadError) {
      throw new Error(`Failed to load member: ${loadError.message}`);
    }
    if (!member) {
      throw new Error("Member not found");
    }

    const timestamp = new Date().toISOString();
    const date = data.date ?? timestamp.slice(0, 10);

    // 2. Persist the member's current attendance status.
    const { error: updateError } = await supabaseAdmin
      .from("members")
      .update({ status: data.status, last_marked_at: timestamp })
      .eq("id", data.memberId);

    if (updateError) {
      throw new Error(`Failed to update attendance: ${updateError.message}`);
    }

    // 2b. Write the permanent dated register entry (one per member per day).
    const { error: recordError } = await supabaseAdmin
      .from("attendance_records")
      .upsert(
        {
          member_id: member.id,
          member_name: member.member_name,
          phone: member.phone,
          attendance_date: date,
          status: data.status,
          marked_at: timestamp,
        },
        { onConflict: "member_id,attendance_date" },
      );

    if (recordError) {
      throw new Error(
        `Failed to save attendance record: ${recordError.message}`,
      );
    }


    // 3. Fire the Make.com webhook (same URL as the kids check-in).
    const webhookUrl =
      process.env["MAKE_WEBHOOK_URL"] ??
      "https://hook.eu1.make.com/e6wgowgxjcqbwujwuuep2hqbkrslsxfo";

    const payload = {
      memberName: member.member_name,
      phone: member.phone,
      date,
      status: data.status,
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
      console.error("Make.com webhook request failed:", err);
    }

    return { ok: true, memberId: data.memberId, status: data.status, date };
  });
