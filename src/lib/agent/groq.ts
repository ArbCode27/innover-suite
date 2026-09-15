import Groq, { toFile } from "groq-sdk";
import { env } from "@/lib/config/env";
import {
  AGENT_FALLBACK_ATTEMPTS,
  AGENT_FALLBACK_MODELS,
  AGENT_GROQ_TIMEOUT_MS,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MODEL,
  AGENT_PRIMARY_ATTEMPTS,
  AGENT_WHISPER_MODEL,
  RETIRED_AGENT_MODELS,
} from "@/lib/agent/constants";
import type { AgentToolDeclaration } from "@/lib/agent/tools";

export type GroqChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

export type GroqFunctionCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type GroqTurnSuccess = {
  ok: true;
  model: string;
  text: string;
  functionCalls: GroqFunctionCall[];
  rawMessage: GroqChatMessage;
  truncated: boolean;
};

export type GroqTurnFailure = {
  ok: false;
  model: string | null;
  error: string;
  status: number | null;
  retryable: boolean;
};

export type GroqTurnOutcome = GroqTurnSuccess | GroqTurnFailure;

let cachedGroqClient: Groq | null = null;

const getGroqClient = (): Groq => {
  if (!cachedGroqClient) {
    cachedGroqClient = new Groq({
      apiKey: env.groqApiKey,
      timeout: AGENT_GROQ_TIMEOUT_MS,
    });
  }
  return cachedGroqClient;
};

export const isGroqConfigured = (): boolean => Boolean(env.groqApiKey);

export const resolveAgentModelCascade = (preferred?: string | null): string[] => {
  const models: string[] = [];
  const add = (model: string) => {
    const trimmed = model.trim();
    if (!trimmed || RETIRED_AGENT_MODELS.has(trimmed) || models.includes(trimmed)) {
      return;
    }
    models.push(trimmed);
  };

  add(preferred ?? "");
  add(AGENT_MODEL);
  for (const fallback of AGENT_FALLBACK_MODELS) {
    add(fallback);
  }

  return models;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (status: number | null, message: string): boolean => {
  if (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate_limit") ||
    normalized.includes("overloaded") ||
    normalized.includes("timeout") ||
    normalized.includes("try again") ||
    normalized.includes("temporar")
  );
};

const parseFunctionArgs = (rawArgs: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(rawArgs);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

const generateGroqTurnOnce = async (params: {
  model: string;
  systemInstruction: string;
  messages: GroqChatMessage[];
  tools: AgentToolDeclaration[];
}): Promise<GroqTurnOutcome> => {
  if (!env.groqApiKey) {
    console.error("[GROQ] ❌ Falta variable de entorno GROQ_API_KEY. Configúrala en .env.local para que la IA pueda responder.");
    return {
      ok: false,
      model: params.model,
      error: "Missing env var: GROQ_API_KEY",
      status: null,
      retryable: false,
    };
  }

  const groq = getGroqClient();

  const fullMessages: GroqChatMessage[] = [
    { role: "system", content: params.systemInstruction },
    ...params.messages,
  ];

  console.log(`[GROQ] 🤖 Solicitando respuesta a Groq (${params.model}) con ${params.messages.length} mensajes y ${params.tools.length} herramientas...`);

  try {
    const response = await groq.chat.completions.create({
      model: params.model,
      messages: fullMessages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
      temperature: 0.4,
      max_completion_tokens: AGENT_MAX_OUTPUT_TOKENS,
      tools: params.tools.length
        ? (params.tools as Parameters<typeof groq.chat.completions.create>[0]["tools"])
        : undefined,
      tool_choice: params.tools.length ? "auto" : undefined,
    });

    const choice = response.choices?.[0];
    if (!choice?.message) {
      console.warn(`[GROQ] ⚠️ Groq no devolvió ningún mensaje de elección (choices vacío).`);
      return {
        ok: false,
        model: params.model,
        error: "Groq no devolvió ningún mensaje.",
        status: null,
        retryable: true,
      };
    }

    const rawMessage = choice.message;
    const text = (rawMessage.content || "").trim();
    const truncated = choice.finish_reason === "length";

    const functionCalls: GroqFunctionCall[] = [];
    if (rawMessage.tool_calls?.length) {
      for (const call of rawMessage.tool_calls) {
        if (call.type === "function" && call.function?.name) {
          functionCalls.push({
            id: call.id,
            name: call.function.name,
            args: parseFunctionArgs(call.function.arguments || "{}"),
          });
        }
      }
    }

    console.log(`[GROQ] ✅ Respuesta exitosa de "${response.model || params.model}": finish_reason=${choice.finish_reason}, texto="${text ? text.slice(0, 100) : '(sin texto)'}...", function_calls=${functionCalls.length}`);

    const assistantChatMessage: GroqChatMessage = {
      role: "assistant",
      content: rawMessage.content ?? null,
      ...(rawMessage.tool_calls?.length
        ? {
            tool_calls: rawMessage.tool_calls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: {
                name: call.function.name,
                arguments: call.function.arguments,
              },
            })),
          }
        : {}),
    };

    return {
      ok: true,
      model: response.model || params.model,
      text,
      functionCalls,
      rawMessage: assistantChatMessage,
      truncated,
    };
  } catch (error) {
    const errorRecord =
      error && typeof error === "object" ? (error as Record<string, unknown>) : null;
    const status = typeof errorRecord?.status === "number" ? errorRecord.status : null;
    const message =
      error instanceof Error ? error.message : "Error desconocido al llamar a Groq";

    console.error(`[GROQ] ❌ Error en llamada a Groq (${params.model}): status=${status} - ${message}`);

    return {
      ok: false,
      model: params.model,
      error: message,
      status,
      retryable: isRetryableError(status, message),
    };
  }
};

export const generateGroqTurn = async (params: {
  preferredModel?: string | null;
  systemInstruction: string;
  messages: GroqChatMessage[];
  tools?: AgentToolDeclaration[];
}): Promise<GroqTurnOutcome> => {
  const models = resolveAgentModelCascade(params.preferredModel);
  let lastFailure: GroqTurnFailure | null = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex]!;
    const maxAttempts = modelIndex === 0 ? AGENT_PRIMARY_ATTEMPTS : AGENT_FALLBACK_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const outcome = await generateGroqTurnOnce({
        model,
        systemInstruction: params.systemInstruction,
        messages: params.messages,
        tools: params.tools ?? [],
      });

      if (outcome.ok) {
        return outcome;
      }

      lastFailure = outcome;
      if (!outcome.retryable) {
        break;
      }

      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
      }
    }
  }

  return (
    lastFailure ?? {
      ok: false,
      model: null,
      error: "No se pudo generar respuesta con Groq.",
      status: null,
      retryable: false,
    }
  );
};

export const transcribeAudioWithGroq = async (params: {
  bytes: Uint8Array;
  mimeType?: string;
  fileName?: string;
}): Promise<string | null> => {
  if (!env.groqApiKey) return null;

  try {
    const groq = getGroqClient();
    const extension = params.mimeType?.includes("mp3")
      ? "mp3"
      : params.mimeType?.includes("wav")
        ? "wav"
        : params.mimeType?.includes("m4a")
          ? "m4a"
          : "ogg";

    const fileName = params.fileName || `audio.${extension}`;
    const file = await toFile(Buffer.from(params.bytes), fileName, {
      type: params.mimeType || "audio/ogg",
    });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: AGENT_WHISPER_MODEL,
      language: "es",
    });

    return transcription.text?.trim() || null;
  } catch (error) {
    console.error("[GROQ_WHISPER] Audio transcription failed:", error);
    return null;
  }
};
