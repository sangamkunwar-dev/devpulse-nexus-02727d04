import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://devpulse.sangamkunwar.com.np";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [`User-agent: *`, `Allow: /`, `Sitemap: ${BASE_URL}/sitemap.xml`].join("\n"),
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
    },
  },
});
