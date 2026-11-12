export const prerender = false;

import { getStats } from "@lib/stats";

export async function GET() {
  return new Response(JSON.stringify(await getStats()), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
