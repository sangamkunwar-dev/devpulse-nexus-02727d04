import Stripe from "stripe";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/payments/stripe-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!); } catch { return new Response("Invalid signature", { status: 400 }); }
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return Response.json({ received: true });
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return Response.json({ received: true });
    const metadata = session.metadata ?? {};
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: payment } = await supabase.from("course_payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("provider_session_id", session.id).select("id,course_id,student_id,teacher_id,amount,currency").maybeSingle();
    if (payment) {
      await supabase.from("course_enrollments").upsert({ course_id: payment.course_id, student_id: payment.student_id, status: "accepted" }, { onConflict: "course_id,student_id" });
      await supabase.from("teacher_earnings").upsert({ payment_id: payment.id, teacher_id: payment.teacher_id, course_id: payment.course_id, amount: payment.amount, currency: payment.currency }, { onConflict: "payment_id" });
    } else if (metadata.course_id && metadata.student_id && metadata.teacher_id) {
      await supabase.from("course_enrollments").upsert({ course_id: metadata.course_id, student_id: metadata.student_id, status: "accepted" }, { onConflict: "course_id,student_id" });
    }
    return Response.json({ received: true });
  } } },
});
