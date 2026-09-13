import Stripe from "stripe";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/payments/stripe-checkout")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: claims } = await supabase.auth.getClaims(token);
    const studentId = claims?.claims?.sub;
    if (!studentId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { courseId } = await request.json() as { courseId?: string };
    const { data: course } = await supabase.from("courses").select("id,title,price,is_free,teacher_id").eq("id", courseId ?? "").eq("published", true).maybeSingle();
    if (!course || course.is_free || !course.price || course.price <= 0) return Response.json({ error: "Paid course not found" }, { status: 400 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({ mode: "payment", line_items: [{ price_data: { currency: "usd", product_data: { name: course.title }, unit_amount: Math.round(Number(course.price) * 100) }, quantity: 1 }], success_url: `${new URL(request.url).origin}/courses?payment=success`, cancel_url: `${new URL(request.url).origin}/courses?payment=cancelled`, metadata: { course_id: course.id, student_id: studentId, teacher_id: course.teacher_id } });
    const { error } = await supabase.from("course_payments").insert({ course_id: course.id, student_id: studentId, teacher_id: course.teacher_id, amount: course.price, provider: "stripe", provider_session_id: session.id });
    if (error) return Response.json({ error: "Could not create payment record" }, { status: 500 });
    return Response.json({ url: session.url });
  } } },
});
