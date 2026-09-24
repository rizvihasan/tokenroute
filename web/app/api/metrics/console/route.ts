import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") ?? "100";
  const resp = await fetch(`${GATEWAY}/metrics/console?limit=${limit}`, { cache: "no-store" });
  return NextResponse.json(await resp.json(), { status: resp.status });
}
