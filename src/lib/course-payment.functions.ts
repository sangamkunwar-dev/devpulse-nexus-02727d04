import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutInput = z.object({
  courseId: z.string().trim().min(1),
  origin: z.string().url().optional(),
  accessToken: z.string().min(1),
});

const khaltiBaseUrl = "https://a.khalti.com/api/v2";

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Response("Card checkout is not configured", { status: 503 });
  return new Stripe(secret);
}

function getKhaltiSecret() {
  const secret = process.env.KHALTI_SECRET_KEY?.trim();
  if (!secret) throw new Response("Khalti is not configured", { status: 503 });
  return secret;
}

async function khaltiRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${khaltiBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Key ${getKhaltiSecret()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Response("Khalti could not start the payment", { status: 502 });
  return response.json() as Promise<{ pidx?: string; payment_url?: string; status?: string; total_amount?: number; purchase_order_id?: string }>;
}

export const verifyCoursePayment = createServerFn({ method: "POST" })
  .validator(z.object({ pidx: z.string().min(1), accessToken: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const response = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
      method: "POST",
      headers: { Authorization: `Key ${getKhaltiSecret()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pidx: data.pidx }),
    });
    const payment = await response.json() as { status?: string; purchase_order_id?: string };
    if (!response.ok || payment.status !== "Completed") throw new Response("Khalti payment was not completed", { status: 400 });
    const [courseId, userId] = (payment.purchase_order_id ?? "").split(":");
    if (!courseId || userId !== context.userId) throw new Response("Payment details do not match this account", { status: 400 });
    const { error } = await (context.supabase as any).from("course_enrollments").upsert(
      { course_id: courseId, student_id: context.userId },
      { onConflict: "course_id,student_id" },
    );
    if (error) throw new Response("Payment verified but enrollment could not be saved", { status: 500 });
    return { success: true, courseId };
  });

async function enrollPaidCourse(supabase: unknown, courseId: string, userId: string) {
  const { error } = await (supabase as any).from("course_enrollments").upsert(
    { course_id: courseId, student_id: userId },
    { onConflict: "course_id,student_id" },
  );
  if (error) throw new Response("Payment verified but enrollment could not be saved", { status: 500 });
  return { success: true, courseId };
}

export const verifyStripeCoursePayment = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().min(1), accessToken: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const session = await getStripeClient().checkout.sessions.retrieve(data.sessionId);
    const courseId = session.metadata?.courseId;
    if (session.payment_status !== "paid" || session.metadata?.userId !== context.userId || !courseId) {
      throw new Response("Card payment was not completed", { status: 400 });
    }
    return enrollPaidCourse(context.supabase, courseId, context.userId);
  });

export const createCardCheckout = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const courseId = data.courseId.trim();
    const { data: course, error } = await (context.supabase as any)
      .from("courses")
      .select("id,title,description,is_free,price")
      .eq("id", courseId)
      .eq("published", true)
      .maybeSingle();
    if (error || !course) throw new Response("Course not found", { status: 404 });
    const price = Number(course.price);
    if (course.is_free || !Number.isFinite(price) || price <= 0) throw new Response("This course is free", { status: 400 });
    const origin = (data.origin || process.env.VITE_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "npr", product_data: { name: course.title }, unit_amount: Math.round(price * 100) }, quantity: 1 }],
      metadata: { courseId: course.id, userId: context.userId },
      success_url: `${origin}/courses?payment=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/courses?payment=cancelled`,
    });
    if (!session.url) throw new Response("Card checkout did not return a checkout URL", { status: 502 });
    return { url: session.url };
  });

export const createCourseCheckout = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const courseId = data.courseId.trim();
    const { data: course, error } = await (context.supabase as any)
      .from("courses")
      .select("id,title,description,is_free,price")
      .eq("id", courseId)
      .eq("published", true)
      .maybeSingle();
    if (error || !course) throw new Response("Course not found", { status: 404 });
    const price = Number(course.price);
    if (course.is_free || !Number.isFinite(price) || price <= 0) throw new Response("This course is free", { status: 400 });
    const origin = (data.origin || process.env.VITE_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const payment = await khaltiRequest("/epayment/initiate/", {
      return_url: `${origin}/courses?payment=khalti`,
      website_url: origin,
      amount: Math.round(price * 100),
      purchase_order_id: `${course.id}:${context.userId}`,
      purchase_order_name: course.title,
    });
    if (!payment.payment_url || !payment.pidx) throw new Response("Khalti did not return a checkout URL", { status: 502 });
    return { url: payment.payment_url };
  });
