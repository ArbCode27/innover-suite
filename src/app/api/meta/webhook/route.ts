import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");

  if (mode !== "subscribe" || !token || token !== VERIFY_TOKEN) {
    return NextResponse.json({ error: "Invalid webhook verification" }, { status: 403 });
  }

  return new NextResponse(challenge || "ok", { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  console.log("[META_WEBHOOK] received", {
    hasBody: Boolean(body),
    object: body?.object || null,
  });

  // TODO: persist webhook events (idempotent by message/event id)
  // TODO: map inbound messages to contacts + conversations + messages
  return NextResponse.json({ ok: true });
}
