import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/markdown", "application/zip"]);

export const Route = createFileRoute("/api/messages/upload")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { data: auth } = await supabaseAdmin.auth.getUser(token);
    if (!auth.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No file provided." }, { status: 400 });
    if (file.size > MAX_SIZE) return Response.json({ error: "Attachments must be 10 MB or smaller." }, { status: 413 });
    if (!ALLOWED.has(file.type)) return Response.json({ error: "This attachment type is not allowed." }, { status: 415 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    const blob = await put(`messages/${auth.user.id}/${crypto.randomUUID()}-${safeName}`, file, { access: "private", addRandomSuffix: false });
    return Response.json({ pathname: blob.pathname, name: file.name, type: file.type, size: file.size });
  } } }
});
