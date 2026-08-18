import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "innover-suite",
    timestamp: new Date().toISOString(),
  });
}
