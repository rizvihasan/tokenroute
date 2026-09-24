import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const conv = req.nextUrl.searchParams.get("conversation_id");
  const url = conv ? `${GATEWAY}/metrics?conversation_id=${conv}` : `${GATEWAY}/metrics`;
  const resp = await fetch(url, { cache: "no-store" });
  return NextResponse.json(await resp.json(), { status: resp.status });
}
