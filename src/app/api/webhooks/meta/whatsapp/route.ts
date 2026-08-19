import type { NextRequest } from "next/server";
import { handleMetaEvent } from "@/lib/webhooks/meta/handle-webhook";
import { handleMetaVerification } from "@/lib/webhooks/meta/verify-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handleMetaVerification(request);

export const POST = (request: NextRequest) => handleMetaEvent(request, "whatsapp");
