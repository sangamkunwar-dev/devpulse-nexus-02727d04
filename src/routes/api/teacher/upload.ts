import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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

        const formData = await request.formData();
        const file = formData.get("file");
        const courseId = String(formData.get("courseId") ?? "");
        if (!(file instanceof File) || !courseId) {
          return Response.json({ error: "File and course are required" }, { status: 400 });
        }
        if (file.size > 250 * 1024 * 1024) {
          return Response.json({ error: "Files must be smaller than 250 MB" }, { status: 413 });
        }

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
