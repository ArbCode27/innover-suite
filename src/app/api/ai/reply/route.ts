import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { suggestReplyAction } from "@/lib/inbox/suggest";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const inputSchema = z.object({
  conversationId: z.number().int().positive(),
  message: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodErrorMessage(parsed.error, "Los datos de la conversación no son válidos.") },
      { status: 400 },
    );
  }

  const result = await suggestReplyAction({ conversationId: parsed.data.conversationId });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    conversationId: parsed.data.conversationId,
  });
}
