import { createServerFn } from "@tanstack/react-start";

/**
 * Safety net for the nightly pg_cron job: makes sure today's Daily Bug exists.
 * Publishing itself happens inside a SECURITY DEFINER SQL function that is
 * idempotent (returns the existing challenge when one is already published).
 */
export const ensureTodayChallenge = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("publish_daily_challenge");
  if (error) {
    console.error("publish_daily_challenge failed", error.message);
    return { challengeId: null as string | null };
  }
  return { challengeId: (data as string | null) ?? null };
});
