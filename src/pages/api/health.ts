export const prerender = false;

export function GET() {
  return new Response("ok", { headers: { "Content-Type": "text/plain" } });
}
