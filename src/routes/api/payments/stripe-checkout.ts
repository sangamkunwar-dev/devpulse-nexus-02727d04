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
    let courseId: string | undefined;
    try {
      courseId = (await request.json() as { courseId?: string }).courseId;
    } catch {
      return Response.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    const { data: course, error: courseError } = await supabase.from("courses").select("id,title,price,is_free,teacher_id").eq("id", courseId ?? "").eq("published", true).maybeSingle();
    if (courseError) return Response.json({ error: `Course lookup failed: ${courseError.message}` }, { status: 500 });
    if (!course || course.is_free || !course.price || course.price <= 0) return Response.json({ error: "Paid course not found or has no valid price" }, { status: 400 });
    if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Stripe is not configured on the server" }, { status: 503 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({ mode: "payment", line_items: [{ price_data: { currency: "usd", product_data: { name: course.title }, unit_amount: Math.round(Number(course.price) * 100) }, quantity: 1 }], success_url: `${new URL(request.url).origin}/courses?payment=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${new URL(request.url).origin}/courses?payment=cancelled`, metadata: { course_id: course.id, student_id: studentId, teacher_id: course.teacher_id } });
    const { error } = await supabase.from("course_payments").insert({ course_id: course.id, student_id: studentId, teacher_id: course.teacher_id, amount: course.price, provider: "stripe", provider_session_id: session.id, status: "pending" });
    if (error) return Response.json({ error: `Could not create payment record: ${error.message}` }, { status: 500 });
    return Response.json({ url: session.url });
  } } },
});
