export const prerender = false;

import { getStats, isStatName } from "@lib/stats";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  if (!params.source || !isStatName(params.source)) {
    return new Response(JSON.stringify({ error: "Unknown source" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stats = await getStats();
  return new Response(JSON.stringify(stats[params.source]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
