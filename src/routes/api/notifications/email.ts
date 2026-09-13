import { createFileRoute } from "@tanstack/react-router";
import { sendNotificationEmail } from "@/lib/notification-email";

export const Route = createFileRoute("/api/notifications/email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !authData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null) as { notificationId?: string } | null;
        if (!body?.notificationId) return Response.json({ error: "notificationId is required" }, { status: 400 });
        const { data: notification } = await supabaseAdmin.from("notifications").select("id,recipient_id,kind,title,body,href").eq("id", body.notificationId).eq("recipient_id", authData.user.id).maybeSingle();
        if (!notification) return Response.json({ error: "Notification not found" }, { status: 404 });
        const result = await sendNotificationEmail({ ...notification, notificationId: notification.id });
        return Response.json(result, { status: result.ok || result.skipped ? 200 : 502 });
      },
    },
  },
});
