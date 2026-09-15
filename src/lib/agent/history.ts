import type { GroqChatMessage } from "@/lib/agent/groq";
import { buildAgentMessageContent } from "@/lib/media/agent";

export const EMPTY_INBOUND_PLACEHOLDER =
  "El cliente envió un mensaje sin texto (historia, share o adjunto no soportado).";

export type AgentHistoryRow = {
  id: number;
  direction: string;
  sender_type: string;
  content: string | null;
  metadata: unknown;
};

const roleForRow = (row: AgentHistoryRow): "user" | "assistant" =>
  row.direction === "inbound" ? "user" : "assistant";

export const historyThroughInbound = <T extends { id: number }>(rows: T[], inboundMessageId: number): T[] => {
  if (!Number.isInteger(inboundMessageId) || inboundMessageId <= 0) {
    return rows;
  }
  const index = rows.findIndex((row) => row.id === inboundMessageId);
  if (index < 0) {
    return rows;
  }
  return rows.slice(0, index + 1);
};

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

const mapPlainHistoryRows = (rows: Array<{ direction: string; content?: string | null }>): GroqChatMessage[] =>
  rows.flatMap((row): GroqChatMessage[] => {
    const text = typeof row.content === "string" ? row.content.trim() : "";
    if (row.direction === "inbound") {
      return [{ role: "user", content: text || EMPTY_INBOUND_PLACEHOLDER }];
    }
    if (!text) return [];
    return [{ role: "assistant", content: text }];
  });

const mergeAdjacentGroqMessages = (messages: GroqChatMessage[]): GroqChatMessage[] => {
  const next: GroqChatMessage[] = [];
  for (const item of messages) {
    if (!item.content) continue;
    const last = next[next.length - 1];
    if (last && last.role === item.role && typeof last.content === "string" && typeof item.content === "string") {
      last.content = `${last.content}\n${item.content}`;
      continue;
    }
    next.push({ ...item });
  }
  return next;
};

export const ensureGroqHistoryForGenerate = (messages: GroqChatMessage[]): GroqChatMessage[] => {
  const next = mergeAdjacentGroqMessages(messages);
  while (next.length > 0 && next[0]?.role === "assistant") {
    next.shift();
  }
  while (next.length > 0 && next[next.length - 1]?.role === "assistant") {
    next.pop();
  }
  return next;
};

export const contentsFromPlainHistory = (
  rows: Array<{ direction: string; content?: string | null }>,
): GroqChatMessage[] => ensureGroqHistoryForGenerate(mapPlainHistoryRows(rows));

export const contentsWithTrailingUserNudge = (
  rows: Array<{ direction: string; content?: string | null }>,
  nudge: string,
): GroqChatMessage[] => {
  const next = mergeAdjacentGroqMessages(mapPlainHistoryRows(rows));
  while (next.length > 0 && next[0]?.role === "assistant") {
    next.shift();
  }
  const trimmed = nudge.trim();
  if (!next.length || !trimmed) {
    return [];
  }
  next.push({ role: "user", content: trimmed });
  return next;
};

const mergeUserMessages = async (group: AgentHistoryRow[], audioMessageIds: Set<number>): Promise<string> => {
  if (group.length === 1) {
    const row = group[0]!;
    const content = await buildAgentMessageContent({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      transcribeAudio: audioMessageIds.has(row.id),
    });
    return content || EMPTY_INBOUND_PLACEHOLDER;
  }

  const lines: string[] = [];
  for (const [index, row] of group.entries()) {
    const content = await buildAgentMessageContent({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      transcribeAudio: audioMessageIds.has(row.id),
    });
    lines.push(`${index + 1}. ${content.trim() || "(sin texto)"}`);
  }

  return `El cliente envió varios mensajes seguidos:\n${lines.join("\n")}`;
};

const mergeAssistantMessages = async (group: AgentHistoryRow[]): Promise<string> => {
  const parts: string[] = [];
  for (const row of group) {
    const content = await buildAgentMessageContent({
      content: typeof row.content === "string" ? row.content : null,
      metadata: row.metadata,
      transcribeAudio: false,
    });
    if (content.trim()) parts.push(content.trim());
  }

  return parts.join("\n");
};

export const buildCoalescedGroqMessages = async (
  rows: AgentHistoryRow[],
  audioMessageIds: Set<number>,
): Promise<GroqChatMessage[]> => {
  const groups: AgentHistoryRow[][] = [];
  for (const row of rows) {
    const current = groups[groups.length - 1];
    if (current?.length && roleForRow(current[0]!) === roleForRow(row)) {
      current.push(row);
      continue;
    }
    groups.push([row]);
  }

  const messages: GroqChatMessage[] = [];
  for (const group of groups) {
    const role = roleForRow(group[0]!);
    const content =
      role === "user"
        ? await mergeUserMessages(group, audioMessageIds)
        : await mergeAssistantMessages(group);

    if (!content.trim()) continue;
    messages.push({ role, content: content.trim() });
  }

  return messages;
};
