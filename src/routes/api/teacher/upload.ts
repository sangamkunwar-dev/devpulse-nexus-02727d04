import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const uploadLimiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(30, "1 h"), prefix: "devpulse:upload" });

export const Route = createFileRoute("/api/teacher/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data, error } = await supabase.auth.getClaims(token);
        if (error || !data?.claims?.sub) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
        const rate = await uploadLimiter.limit(ip);
        if (!rate.success) return Response.json({ error: "Upload limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))) } });

        const formData = await request.formData();
        const file = formData.get("file");
        const courseId = String(formData.get("courseId") ?? "");
        if (!(file instanceof File) || !courseId) {
          return Response.json({ error: "File and course are required" }, { status: 400 });
        }
        if (file.size > 250 * 1024 * 1024) {
          return Response.json({ error: "Files must be smaller than 250 MB" }, { status: 413 });
        }
        const allowedTypes = new Set(["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp", "video/mp4", "audio/mpeg", "application/zip"]);
        if (file.type && !allowedTypes.has(file.type)) return Response.json({ error: "This file type is not allowed." }, { status: 415 });

        const { data: course } = await supabase
          .from("courses")
          .select("id")
          .eq("id", courseId)
          .eq("teacher_id", data.claims.sub)
          .maybeSingle();
        if (!course) return Response.json({ error: "Course not found" }, { status: 404 });

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const blob = await put(`courses/${courseId}/${crypto.randomUUID()}-${safeName}`, file, {
          access: "private",
          addRandomSuffix: false,
          contentType: file.type || "application/octet-stream",
        });
        return Response.json({
          pathname: blob.pathname,
          filename: file.name,
          contentType: file.type,
        });
      },
    },
  },
});
