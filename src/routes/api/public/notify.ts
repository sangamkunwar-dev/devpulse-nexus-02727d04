import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "sangamkunwar48@gmail.com";

type Body = { kind?: string; payload?: Record<string, unknown> };

function esc(v: unknown) {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
}

function buildEmail(kind: string, p: Record<string, unknown>) {
  if (kind === "challenge_published") {
    return {
      subject: `DevPulse — new Daily Bug published: ${esc(p['title'])}`,
      html: `<h2>New Daily Bug is live</h2>
        <p><strong>${esc(p['title'])}</strong> (${esc(p['language'])} · ${esc(p['difficulty'])} · +${esc(p['xp'])} XP)</p>
        <p>${esc(p['prompt'])}</p>
        <p>Date: ${esc(p['date'])}</p>
        <p><a href="https://devpulse-nexus.lovable.app/challenges">Open the challenge</a></p>`,
    };
  }
  if (kind === "correct_answer") {
    return {
      subject: `DevPulse — ${esc(p['username'])} solved "${esc(p['title'])}"`,
      html: `<h2>Correct answer submitted</h2>
        <p><strong>@${esc(p['username'])}</strong> patched <strong>${esc(p['title'])}</strong>.</p>
        <pre style="background:#111;color:#eee;padding:12px;border-radius:8px">${esc(p['answer'])}</pre>
        <p><a href="https://devpulse-nexus.lovable.app/admin">Open admin</a></p>`,
    };
  }
  return null;
}

export const Route = createFileRoute("/api/public/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-notify-secret") ?? "";
        if (!provided) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("app_config" as never)
          .select("value")
          .eq("key", "notify_secret")
          .maybeSingle<{ value: string }>();

        const expected = cfg?.value ?? "";
        if (!expected || expected.length !== provided.length || expected !== provided) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const mail = buildEmail(body.kind ?? "", body.payload ?? {});
        if (!mail) return new Response("Ignored", { status: 200 });

        const apiKey = process.env['RESEND_API_KEY'];
        if (!apiKey) return new Response("Email not configured", { status: 200 });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "DevPulse <onboarding@resend.dev>",
            to: [ADMIN_EMAIL],
            subject: mail.subject,
            html: mail.html,
          }),
        });
        if (!res.ok) {
          console.error("resend failed", res.status);
          return new Response("Email failed", { status: 502 });
        }
        return new Response("ok");
      },
    },
  },
});
