import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

async function generateDailyBug(date: string): Promise<GeneratedChallenge> {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: generatedChallengeSchema,
    system: "You create safe, educational daily debugging challenges for software developers. Return exactly one self-contained bug with one clear corrected answer. Do not include secrets, credentials, malware, exploit instructions, or harmful code.",
    prompt: `Create a fresh debugging challenge for ${date}. Vary the language and bug category from common web development issues. The broken code must be valid-looking and the answer_pattern must be a regex compatible with PostgreSQL regexp_match. Keep the fix unambiguous and explain why it works.`,
  });
  return generatedChallengeSchema.parse(object);
}

async function publishTemplateFallback(supabaseAdmin: any, date: string) {
  const { data: template, error: templateError } = await supabaseAdmin
    .from("challenge_templates")
    .select("id, title, language, difficulty, prompt, broken_code, hint, xp_reward, answer_pattern, explanation")
    .order("last_used_on", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) throw new Error("No challenge templates are available.");

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from("challenges")
    .insert({
      challenge_date: date,
      title: template.title,
      language: template.language,
      difficulty: template.difficulty,
      prompt: template.prompt,
      broken_code: template.broken_code,
      hint: template.hint,
      xp_reward: template.xp_reward,
      source: "template",
    })
    .select("id")
    .single();
  if (challengeError) throw challengeError;

  const { error: solutionError } = await supabaseAdmin.from("challenge_solutions").insert({
    challenge_id: challenge.id,
    answer_pattern: template.answer_pattern,
    explanation: template.explanation,
  });
  if (solutionError) {
    await supabaseAdmin.from("challenges").delete().eq("id", challenge.id);
    throw solutionError;
  }

  await supabaseAdmin
    .from("challenge_templates")
    .update({ last_used_on: date })
    .eq("id", template.id);

  return { challengeId: challenge.id, source: "template" as const, error: null };
}

/** Publishes one date exactly once. AI is preferred; the vetted template bank is the fallback. */
export async function publishDailyBug(supabaseAdmin: any, date: string) {
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
      return raced ? { challengeId: raced.id, source: raced.source ?? "template", error: null } : await publishTemplateFallback(supabaseAdmin, date);
    }
    const { error: solutionError } = await supabaseAdmin.from("challenge_solutions").insert({ challenge_id: inserted.id, answer_pattern: bug.answer_pattern, explanation: bug.explanation });
    if (solutionError) {
      await supabaseAdmin.from("challenges").delete().eq("id", inserted.id);
      return await publishTemplateFallback(supabaseAdmin, date);
    }
    return { challengeId: inserted.id, source: "ai" as const, error: null };
  } catch (generationError) {
    console.error("[daily-bug] AI generation failed; using template fallback", generationError);
    try {
      return await publishTemplateFallback(supabaseAdmin, date);
    } catch (fallbackError) {
      console.error("[daily-bug] Template fallback failed", fallbackError);
      return { challengeId: null, source: null, error: "generation_failed" as const };
    }
  }
}

export const ensureTodayChallenge = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return publishDailyBug(supabaseAdmin, todayISO());
});
