import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCourseCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const courseId = typeof data === "string" ? data : "";
    if (!courseId) throw new Response("Course is required", { status: 400 });

    const { data: course, error } = await context.supabase
      .from("courses")
      .select("id,title,description,is_free,price")
      .eq("id", courseId)
      .eq("published", true)
      .maybeSingle();

    if (error || !course) throw new Response("Course not found", { status: 404 });
    if (course.is_free || Number(course.price) <= 0) throw new Response("This course is free", { status: 400 });

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Response("Stripe is not configured", { status: 503 });

    const stripe = new Stripe(secretKey);
    const origin = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: course.title, description: course.description ?? undefined },
          unit_amount: Math.round(Number(course.price) * 100),
        },
        quantity: 1,
      }],
      customer_email: context.user.email,
      metadata: { courseId: course.id, studentId: context.userId },
      success_url: `${origin}/courses?payment=success&course=${encodeURIComponent(course.id)}`,
      cancel_url: `${origin}/courses?payment=cancelled`,
    });

    if (!session.url) throw new Response("Could not start checkout", { status: 502 });
    return { url: session.url };
  });
