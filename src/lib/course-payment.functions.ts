import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutInput = z.object({
  courseId: z.string().trim().min(1),
  origin: z.string().url().optional(),
  accessToken: z.string().min(1),
});

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Response("Stripe is not configured", { status: 503 });
  return new Stripe(secretKey);
}

export const verifyCoursePayment = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().min(1), accessToken: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const session = await getStripe().checkout.sessions.retrieve(data.sessionId);
    if (session.payment_status !== "paid" || session.metadata?.userId !== context.userId) {
      throw new Response("Stripe payment was not completed", { status: 400 });
    }
    const courseId = session.metadata?.courseId;
    if (!courseId) throw new Response("Payment is missing course details", { status: 400 });
    const { error } = await (context.supabase as any).from("course_enrollments").upsert(
      { course_id: courseId, student_id: context.userId },
      { onConflict: "course_id,student_id" },
    );
    if (error) throw new Response("Payment verified but enrollment could not be saved", { status: 500 });
    return { success: true, courseId };
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
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      ui_mode: "hosted_page",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: course.title, description: course.description || undefined },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      metadata: { courseId: course.id, userId: context.userId },
      success_url: `${origin}/courses?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/courses?payment=cancelled`,
    });

    if (!session.url) throw new Response("Stripe did not return a checkout URL", { status: 502 });
    return { url: session.url };
  });
