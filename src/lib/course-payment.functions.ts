import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutInput = z.object({
  courseId: z.string().trim().min(1),
  origin: z.string().url().optional(),
  accessToken: z.string().min(1),
});

function getKhaltiConfig() {
  const secret = process.env.KHALTI_SECRET_KEY?.trim();
  if (!secret) throw new Response("Khalti is not configured", { status: 503 });

  // Khalti sandbox keys must use the sandbox API and sandbox checkout account.
  const baseUrl = secret.includes("test_")
    ? "https://dev.khalti.com/api/v2"
    : "https://khalti.com/api/v2";

  return { secret, baseUrl };
}

async function khaltiRequest(path: string, body: Record<string, unknown>) {
  const { baseUrl, secret } = getKhaltiConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Key ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as {
    pidx?: string;
    payment_url?: string;
    status?: string;
    total_amount?: number;
    purchase_order_id?: string;
    detail?: string;
    error_key?: string;
  } | null;
  if (!response.ok) {
    const detail = payload?.detail || payload?.error_key;
    throw new Response(detail ? `Khalti checkout error: ${detail}` : "Khalti could not start the payment", { status: 502 });
  }
  return payload ?? {};
}

export const verifyCoursePayment = createServerFn({ method: "POST" })
  .validator(z.object({ pidx: z.string().min(1), accessToken: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { baseUrl, secret } = getKhaltiConfig();
    const response = await fetch(`${baseUrl}/epayment/lookup/`, {
      method: "POST",
      headers: { Authorization: `Key ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pidx: data.pidx }),
    });
    const payment = await response.json() as { status?: string; purchase_order_id?: string };
    const paymentStatus = payment.status?.trim().toLowerCase();
    if (!response.ok || paymentStatus !== "completed") {
      throw new Response("Khalti payment was not completed", { status: 400 });
    }
    const [courseId, userId] = (payment.purchase_order_id ?? "").split(":");
    if (!courseId || userId !== context.userId) throw new Response("Payment details do not match this account", { status: 400 });
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
