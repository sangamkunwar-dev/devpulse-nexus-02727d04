import { createFileRoute } from "@tanstack/react-router";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "devpulse:signup",
});

export const Route = createFileRoute("/api/auth/signup-limit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const forwardedFor = request.headers.get("x-forwarded-for");
        const realIp = request.headers.get("x-real-ip");
        const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
        const result = await limiter.limit(ip);
        return Response.json(
          { allowed: result.success, retryAfter: result.success ? 0 : Math.ceil((result.reset - Date.now()) / 1000) },
          {
            status: result.success ? 200 : 429,
            headers: result.success ? {} : { "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))) },
          },
        );
      },
    },
  },
});
