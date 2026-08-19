import { NextRequest, NextResponse } from "next/server";
import { asRecord, asString } from "@/lib/webhooks/meta/json";
import { normalizeSocialEvents } from "@/lib/webhooks/meta/normalize-social";
import { normalizeWhatsappEvents } from "@/lib/webhooks/meta/normalize-whatsapp";
import { persistInboundMessages } from "@/lib/webhooks/meta/persist-inbound-message";
import type { MetaWebhookKind } from "@/lib/webhooks/meta/types";
import { verifyMetaSignature } from "@/lib/webhooks/meta/verify-signature";
import { env } from "@/lib/config/env";

const SOCIAL_OBJECTS = new Set(["page", "instagram"]);
const WHATSAPP_OBJECT = "whatsapp_business_account";

const parseJsonPayload = (rawBody: string) => {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
};

const resolveKind = (kind: MetaWebhookKind, objectType: string | null): "social" | "whatsapp" | null => {
  if (kind === "social") {
    return objectType && SOCIAL_OBJECTS.has(objectType) ? "social" : null;
  }

  if (kind === "whatsapp") {
    return objectType === WHATSAPP_OBJECT ? "whatsapp" : null;
  }

  if (objectType && SOCIAL_OBJECTS.has(objectType)) {
    return "social";
  }

  if (objectType === WHATSAPP_OBJECT) {
    return "whatsapp";
  }

  return null;
};

export const handleMetaEvent = async (request: NextRequest, kind: MetaWebhookKind) => {
  if (!env.metaAppSecret) {
    return NextResponse.json(
      { error: "Missing env var: META_APP_SECRET" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = parseJsonPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const objectType = asString(asRecord(payload)?.object);
  const resolvedKind = resolveKind(kind, objectType);
  if (!resolvedKind) {
    return NextResponse.json({ ok: true, ignored: true, object: objectType });
  }

  const events =
    resolvedKind === "whatsapp"
      ? normalizeWhatsappEvents(payload)
      : normalizeSocialEvents(payload);

  if (events.length === 0) {
    return NextResponse.json({
      ok: true,
      channelGroup: resolvedKind,
      processed: 0,
      duplicates: 0,
      ignored: 0,
    });
  }

  if (!env.supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing env var: SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  try {
    const result = await persistInboundMessages(events);
    return NextResponse.json({
      ok: true,
      channelGroup: resolvedKind,
      ...result,
    });
  } catch (error) {
    console.error("[META_WEBHOOK] request failed", error);
    return NextResponse.json({ error: "Failed to persist webhook events" }, { status: 500 });
  }
};
