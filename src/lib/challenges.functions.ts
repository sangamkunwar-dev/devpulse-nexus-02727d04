import { createServerFn } from "@tanstack/react-start";
import { generateObject, gateway } from "ai";
import { z } from "zod";

const generatedChallengeSchema = z.object({
  title: z.string().min(4).max(80),
  language: z.string().min(2).max(30),
  difficulty: z.enum(["easy", "medium", "hard"]),
  xp_reward: z.number().int().min(20).max(100),
  prompt: z.string().min(20).max(500),
  broken_code: z.string().min(10).max(3000),
  answer_pattern: z.string().min(3).max(500),
  explanation: z.string().min(20).max(600),
  hint: z.string().min(5).max(240),
});

type GeneratedChallenge = z.infer<typeof generatedChallengeSchema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function generateDailyBug(date: string): Promise<GeneratedChallenge> {
  const { object } = await generateObject({
    model: gateway("google/gemini-3.5-flash"),
    schema: generatedChallengeSchema,
    system: "You create safe, educational daily debugging challenges for software developers. Return exactly one self-contained bug with one clear corrected answer. Do not include secrets, credentials, malware, exploit instructions, or harmful code.",
    prompt: `Create a fresh debugging challenge for ${date}. Vary the language and bug category from common web development issues. The broken code must be valid-looking and the answer_pattern must be a regex compatible with PostgreSQL regexp_match. Keep the fix unambiguous and explain why it works.`,
  });
  return generatedChallengeSchema.parse(object);
}

async function publishTemplateFallback(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin.rpc("publish_daily_challenge");
  if (error) throw error;
  return { challengeId: (data as string | null) ?? null, source: "template" as const };
}

/** Ensures today's challenge exists. AI is preferred; the vetted SQL template bank is the fallback. */
export const ensureTodayChallenge = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const date = todayISO();

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("challenges")
    .select("id, source")
    .eq("challenge_date", date)
    .maybeSingle();
  if (lookupError) return { challengeId: null, source: null, error: "lookup_failed" as const };
  if (existing) return { challengeId: existing.id, source: existing.source ?? "template", error: null };

  try {
    const bug = await generateDailyBug(date);
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("challenges")
      .insert({ challenge_date: date, title: bug.title, language: bug.language, difficulty: bug.difficulty, prompt: bug.prompt, broken_code: bug.broken_code, hint: bug.hint, xp_reward: bug.xp_reward, source: "ai" })
      .select("id")
      .single();
    if (insertError) {
      const { data: raced } = await supabaseAdmin.from("challenges").select("id, source").eq("challenge_date", date).maybeSingle();
      return raced ? { challengeId: raced.id, source: raced.source ?? "template", error: null } : await publishTemplateFallback(supabaseAdmin);
    }
    const { error: solutionError } = await supabaseAdmin.from("challenge_solutions").insert({ challenge_id: inserted.id, answer_pattern: bug.answer_pattern, explanation: bug.explanation });
    if (solutionError) {
      await supabaseAdmin.from("challenges").delete().eq("id", inserted.id);
      return await publishTemplateFallback(supabaseAdmin);
    }
    return { challengeId: inserted.id, source: "ai" as const, error: null };
  } catch {
    try {
      return await publishTemplateFallback(supabaseAdmin);
    } catch {
      return { challengeId: null, source: null, error: "generation_failed" as const };
    }
  }
});
