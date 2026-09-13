import { get } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/messages/file")({
  server: { handlers: { GET: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const pathname = new URL(request.url).searchParams.get("pathname");
    if (!token || !pathname || !pathname.startsWith("messages/")) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { data: auth } = await supabaseAdmin.auth.getUser(token);
    if (!auth.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const result = await get(pathname, { access: "private" });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(result.stream, { headers: { "Content-Type": result.blob.contentType, ETag: result.blob.etag, "Content-Disposition": `attachment; filename="${result.blob.pathname.split("/").pop()?.replace(/^[^-]+-/, "") ?? "attachment"}"`, "Cache-Control": "private, no-cache" } });
  } } }
});
