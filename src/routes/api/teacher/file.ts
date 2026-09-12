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
        const { data: lesson } = await supabase
          .from("course_lessons")
          .select("id, courses!inner(teacher_id, published)")
          .eq("asset_path", pathname)
          .or(`published.eq.true,teacher_id.eq.${claims.claims.sub}`, { foreignTable: "courses" })
          .maybeSingle();
        if (!lesson) return Response.json({ error: "Forbidden" }, { status: 403 });
        const result = await get(pathname, { access: "private" });
        if (!result) return new Response("Not found", { status: 404 });
        return new Response(result.stream, {
          headers: {
            "Content-Type": result.blob.contentType,
            "Cache-Control": "private, no-cache",
            ETag: result.blob.etag,
          },
        });
      },
    },
  },
});
