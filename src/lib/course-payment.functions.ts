import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutInput = z.object({
  courseId: z.string().trim().min(1),
  origin: z.string().url().optional(),
  accessToken: z.string().min(1),
});

export const verifyCoursePayment = createServerFn({ method: "POST" })
  .validator(z.object({ pidx: z.string().min(1), courseId: z.string().min(1), accessToken: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const secretKey = process.env.KHALTI_SECRET_KEY;
    if (!secretKey) throw new Response("Khalti is not configured", { status: 503 });
    const response = await fetch("https://a.khalti.com/api/v2/epayment/lookup/", {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pidx: data.pidx }),
    });
    if (!response.ok) throw new Response("Could not verify Khalti payment", { status: 502 });
    const payment = (await response.json()) as { status?: string; total_amount?: number; transaction_id?: string };
    if (payment.status !== "Completed") throw new Response("Khalti payment was not completed", { status: 400 });
    const { error } = await (context.supabase as any).from("course_enrollments").upsert(
      { course_id: data.courseId, student_id: context.userId },
      { onConflict: "course_id,student_id" },
    );
    if (error) throw new Response("Payment verified but enrollment could not be saved", { status: 500 });
    return { success: true };
  });

export const createCourseCheckout = createServerFn({ method: "POST" })
  .validator(checkoutInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const input = data;
    const courseId = input?.courseId?.trim() ?? "";
    if (!courseId) throw new Response("Course is required", { status: 400 });

    const { data: course, error } = await (context.supabase as any)
      .from("courses")
      .select("id,title,description,is_free,price")
      .eq("id", courseId)
      .eq("published", true)
      .maybeSingle();

    if (error || !course) throw new Response("Course not found", { status: 404 });
    const price = Number(course.price);
    if (course.is_free || !Number.isFinite(price) || price <= 0) {
      throw new Response("This course is free", { status: 400 });
    }

    const secretKey = process.env.KHALTI_SECRET_KEY;
    if (!secretKey) throw new Response("Khalti is not configured", { status: 503 });

    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL;
    const requestedOrigin = input?.origin?.trim();
    const origin = (requestedOrigin || configuredOrigin || "http://localhost:3000").replace(/\/$/, "");
    if (!/^https?:\/\//i.test(origin)) throw new Response("Invalid checkout origin", { status: 400 });

    const amount = Math.round(price * 100);
    const response = await fetch("https://a.khalti.com/api/v2/epayment/initiate/", {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        return_url: `${origin}/courses?payment=success&course=${encodeURIComponent(course.id)}`,
        website_url: origin,
        amount,
        purchase_order_id: course.id,
        purchase_order_name: course.title,
        customer_info: typeof context.claims.email === "string" ? { email: context.claims.email } : undefined,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("[v0] Khalti initiation failed:", response.status, details);
      throw new Response("Could not start Khalti checkout", { status: 502 });
    }
    const checkout = (await response.json()) as { payment_url?: string };
    if (!checkout.payment_url) throw new Response("Khalti did not return a payment URL", { status: 502 });
    return { url: checkout.payment_url };
  });
