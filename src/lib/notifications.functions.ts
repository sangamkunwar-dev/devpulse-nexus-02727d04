import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a test notification email to every enabled recipient.
 * Admin-only: the caller's role is verified with their own (RLS-scoped) client
 * before any privileged work happens.
 */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("notification_recipients" as never)
      .select("email, enabled")
      .eq("enabled", true)
      .returns<{ email: string; enabled: boolean }[]>();

    const recipients = (rows ?? []).map((r) => r.email).filter(Boolean);
    if (!recipients.length) {
      return { ok: false, sent: 0, message: "No enabled recipients configured." };
    }

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      return { ok: false, sent: 0, message: "Email sending is not configured." };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "DevPulse <onboarding@resend.dev>",
        to: recipients,
        subject: "DevPulse — admin notification test",
        html: `<h2>Notifications are wired up</h2>
          <p>This is a test from the DevPulse admin panel. Daily Bug publishes and correct answers will be delivered to this address.</p>
          <p>Recipients: ${recipients.map((r) => r.replace(/[<>&]/g, "")).join(", ")}</p>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`resend test failed [${res.status}]: ${body}`);
      return { ok: false, sent: 0, message: `Email provider error [${res.status}]: ${body.slice(0, 300)}` };
    }

    return { ok: true, sent: recipients.length, message: `Test email sent to ${recipients.length} recipient(s).` };
  });
