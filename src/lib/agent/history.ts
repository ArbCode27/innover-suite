import type { GeminiContent, GeminiPart } from "@/lib/agent/gemini";
import { buildGeminiMessageParts } from "@/lib/media/agent";

export type AgentHistoryRow = {
  id: number;
  direction: string;
  sender_type: string;
  content: string | null;
  metadata: unknown;
};

const roleForRow = (row: AgentHistoryRow): "user" | "model" =>
  row.direction === "inbound" ? "user" : "model";

const isTextPart = (part: GeminiPart): part is GeminiPart & { text: string } =>
  "text" in part && typeof part.text === "string";

export const trailingInboundText = (rows: AgentHistoryRow[]) => {
  const trailing: string[] = [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row || row.direction !== "inbound") break;
    const text = typeof row.content === "string" ? row.content.trim() : "";
    if (text) trailing.unshift(text);
  }
  return trailing.join("\n");
};

export const trailingInboundIds = (rows: AgentHistoryRow[]) => {
  const ids = new Set<number>();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row || row.direction !== "inbound") break;
    ids.add(row.id);
  }
  return ids;
};

const mergeUserParts = async (group: AgentHistoryRow[], binaryMessageIds: Set<number>) => {
  if (group.length === 1) {
    const row = group[0]!;
    return buildGeminiMessageParts({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      includeBinary: binaryMessageIds.has(row.id),
    });
  }

  const lines: string[] = [];
  const extraParts: GeminiPart[] = [];
  for (const [index, row] of group.entries()) {
    const rowParts = await buildGeminiMessageParts({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      includeBinary: binaryMessageIds.has(row.id),
    });
    const text = rowParts
      .filter(isTextPart)
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join(" ");
    lines.push(`${index + 1}. ${text || "(sin texto)"}`);
    extraParts.push(...rowParts.filter((part) => !isTextPart(part)));
  }

  return [
    { text: `El cliente envió varios mensajes seguidos:\n${lines.join("\n")}` } satisfies GeminiPart,
    ...extraParts,
  ];
};

const mergeModelParts = async (group: AgentHistoryRow[]) => {
  const parts: GeminiPart[] = [];
  for (const row of group) {
    const rowParts = await buildGeminiMessageParts({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      includeBinary: false,
    });
    parts.push(...rowParts);
  }

  if (group.length < 2) return parts;

  const text = parts
    .filter(isTextPart)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n");
  const rest = parts.filter((part) => !isTextPart(part));
  return text ? [{ text } satisfies GeminiPart, ...rest] : rest;
};

export const buildCoalescedGeminiContents = async (
  rows: AgentHistoryRow[],
  binaryMessageIds: Set<number>,
): Promise<GeminiContent[]> => {
  const groups: AgentHistoryRow[][] = [];
  for (const row of rows) {
    const current = groups[groups.length - 1];
    if (current?.length && roleForRow(current[0]!) === roleForRow(row)) {
      current.push(row);
      continue;
    }
    groups.push([row]);
  }

  const contents: GeminiContent[] = [];
  for (const group of groups) {
    const role = roleForRow(group[0]!);
    const parts = role === "user" ? await mergeUserParts(group, binaryMessageIds) : await mergeModelParts(group);
    if (!parts.length) continue;
    contents.push({ role, parts });
  }

  return contents;
};
