import { get } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/teacher/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pathname = new URL(request.url).searchParams.get("pathname");
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!pathname || !token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: claims } = await supabase.auth.getClaims(token);
        if (!claims?.claims?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { data: file } = await supabase
          .from("course_files")
          .select("id, course_id, courses!inner(teacher_id, published)")
          .eq("storage_path", pathname)
          .maybeSingle();
        if (!file) return Response.json({ error: "Forbidden" }, { status: 403 });
        const { data: enrollment } = await supabase
          .from("course_enrollments")
          .select("id")
          .eq("course_id", file.course_id)
          .eq("student_id", claims.claims.sub)
          .eq("status", "accepted")
          .maybeSingle();
        const course = file.courses as { teacher_id: string; published: boolean };
        if (course.teacher_id !== claims.claims.sub && !course.published && !enrollment) return Response.json({ error: "Forbidden" }, { status: 403 });
        const result = await get(pathname, { access: "private" });
        if (!result) return new Response("Not found", { status: 404 });
        return new Response(result.stream, {
          headers: {
            "Content-Type": result.blob.contentType ?? "application/octet-stream",
            "Cache-Control": "private, no-cache",
            ETag: result.blob.etag,
          },
        });
      },
    },
  },
});
