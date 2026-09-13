import Stripe from "stripe";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/payments/stripe-verify")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: claims } = await authClient.auth.getClaims(token);
    const studentId = claims?.claims?.sub;
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!studentId || !sessionId) return Response.json({ error: "Invalid payment session" }, { status: 400 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" || session.metadata?.student_id !== studentId) return Response.json({ error: "Payment has not been verified" }, { status: 402 });
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const metadata = session.metadata ?? {};
    const { data: payment } = await admin.from("course_payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("provider_session_id", session.id).select("id,course_id,student_id,teacher_id,amount,currency").maybeSingle();
    if (!payment && !metadata.course_id) return Response.json({ error: "Payment record not found" }, { status: 404 });
    const courseId = payment?.course_id ?? metadata.course_id!;
    const teacherId = payment?.teacher_id ?? metadata.teacher_id!;
    await admin.from("course_enrollments").upsert({ course_id: courseId, student_id: studentId, status: "accepted" }, { onConflict: "course_id,student_id" });
    if (payment) await admin.from("teacher_earnings").upsert({ payment_id: payment.id, teacher_id: teacherId, course_id: courseId, amount: payment.amount, currency: payment.currency }, { onConflict: "payment_id" });
    return Response.json({ verified: true, courseId });
  } } },
});
