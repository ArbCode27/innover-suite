import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";

const hasSameToken = (received: string, expected: string) => {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
};

export const handleMetaVerification = (request: NextRequest) => {
  const search = request.nextUrl.searchParams;
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");
  const expectedToken = env.metaWebhookVerifyToken;

  if (mode !== "subscribe" || !token || !expectedToken || !hasSameToken(token, expectedToken)) {
    return NextResponse.json({ error: "Invalid webhook verification" }, { status: 403 });
  }

  return new NextResponse(challenge || "ok", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
