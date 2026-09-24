import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  const resp = await fetch(`${GATEWAY}/evals/latest`, { cache: "no-store" });
  return NextResponse.json(await resp.json(), { status: resp.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({ lane: "local" }));
  const resp = await fetch(`${GATEWAY}/evals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await resp.json(), { status: resp.status });
}
