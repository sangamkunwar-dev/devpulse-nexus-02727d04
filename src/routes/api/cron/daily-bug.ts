import { createFileRoute } from "@tanstack/react-router";
import { publishDailyBug } from "@/lib/challenges.functions";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  return authorization === `Bearer ${secret}` || vercelCron === "1";
}

function getLocalDateAndTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export const Route = createFileRoute("/api/cron/daily-bug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings, error } = await supabaseAdmin
          .from("daily_bug_settings" as never)
          .select("publish_time, timezone")
          .eq("id", true)
          .maybeSingle<{ publish_time: string; timezone: string }>();

        if (error) {
          console.error("[daily-bug-cron] settings lookup failed", error);
          return Response.json({ error: "settings_lookup_failed" }, { status: 500 });
        }
        if (!settings) return Response.json({ skipped: true, reason: "schedule_not_configured" });

        let local;
        try {
          local = getLocalDateAndTime(settings.timezone);
        } catch {
          return Response.json({ error: "invalid_timezone" }, { status: 500 });
        }

        const scheduledTime = settings.publish_time.slice(0, 5);
        // Vercel Cron can arrive a few minutes late. Publish once the scheduled
        // minute has passed; publishDailyBug's date check keeps this idempotent.
        if (local.time < scheduledTime) {
          return Response.json({ skipped: true, date: local.date, time: local.time, scheduledTime });
        }

        const result = await publishDailyBug(supabaseAdmin, local.date);
        if (result.error) {
          console.error("[daily-bug-cron] publish failed", result.error);
          return Response.json(result, { status: 500 });
        }
        return Response.json({ ...result, date: local.date, timeZone: settings.timezone });
      },
    },
  },
});
