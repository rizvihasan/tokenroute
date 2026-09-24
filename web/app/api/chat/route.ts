import { NextRequest } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? "http://localhost:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetch(`${GATEWAY}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "gateway error");
    return new Response(JSON.stringify({ error: detail }), {
      status: upstream.status || 502,
      headers: { "content-type": "application/json" },
    });
  }

  // pass the SSE stream through untouched so tokens reach the browser live
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
