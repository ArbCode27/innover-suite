import { env } from "@/lib/config/env";
import {
  AGENT_FALLBACK_ATTEMPTS,
  AGENT_FALLBACK_MODELS,
  AGENT_MODEL,
  AGENT_PRIMARY_ATTEMPTS,
  RETIRED_AGENT_MODELS,
} from "@/lib/agent/constants";

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiFunctionCall = { name: string; args: Record<string, unknown> };

export type GeminiTurnSuccess = {
  ok: true;
  model: string;
  text: string;
  functionCalls: GeminiFunctionCall[];
};

export type GeminiTurnFailure = {
  ok: false;
  model: string | null;
  error: string;
  status: number | null;
  retryable: boolean;
};

export type GeminiTurnOutcome = GeminiTurnSuccess | GeminiTurnFailure;

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{
        text?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
    };
  }>;
  error?: { message?: string; status?: string; code?: number };
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 12_000;

export const isGeminiConfigured = () => Boolean(env.geminiApiKey);

export const resolveAgentModelCascade = (preferred?: string | null) => {
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
  for (const model of AGENT_FALLBACK_MODELS) {
    add(model);
  }

  return models;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createTimeoutSignal = () => {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  return controller.signal;
};

const isRetryableFailure = (status: number | null, message: string) => {
  if (status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("overload") ||
    normalized.includes("unavailable") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("high demand") ||
    normalized.includes("try again") ||
    normalized.includes("timeout") ||
    normalized.includes("temporar") ||
    normalized.includes("aborted")
  );
};

const isRetiredModelError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no longer available") ||
    normalized.includes("not found") ||
    normalized.includes("is not supported")
  );
};

const generateGeminiTurnOnce = async (params: {
  model: string;
  systemInstruction: string;
  contents: GeminiContent[];
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}): Promise<GeminiTurnOutcome> => {
  if (!env.geminiApiKey) {
    return {
      ok: false,
      model: params.model,
      error: "Missing env var: GEMINI_API_KEY",
      status: null,
      retryable: false,
    };
  }

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: params.contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  if (params.tools.length) {
    body.tools = [{ functionDeclarations: params.tools }];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: createTimeoutSignal(),
    });

    const json = (await response.json()) as GeminiGenerateResponse;
    const errorMessage = json.error?.message || `Gemini rechazó la solicitud (${response.status}).`;

    if (!response.ok) {
      return {
        ok: false,
        model: params.model,
        error: errorMessage,
        status: response.status,
        retryable: isRetryableFailure(response.status, errorMessage) || isRetiredModelError(errorMessage),
      };
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts
      .filter((part) => part.functionCall?.name)
      .map((part) => ({
        name: part.functionCall!.name as string,
        args: part.functionCall?.args ?? {},
      }));
    const text = parts
      .map((part) => part.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .trim();

    return { ok: true, model: params.model, text, functionCalls };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo contactar a Gemini.";
    return {
      ok: false,
      model: params.model,
      error: message,
      status: null,
      retryable: isRetryableFailure(null, message),
    };
  }
};

export const generateGeminiTurn = async (params: {
  preferredModel?: string | null;
  systemInstruction: string;
  contents: GeminiContent[];
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}): Promise<GeminiTurnOutcome> => {
  const models = resolveAgentModelCascade(params.preferredModel);
  let lastFailure: GeminiTurnFailure = {
    ok: false,
    model: models[0] ?? null,
    error: "No hay modelos de Gemini configurados.",
    status: null,
    retryable: false,
  };

  for (const [index, model] of models.entries()) {
    const attempts = index === 0 ? AGENT_PRIMARY_ATTEMPTS : AGENT_FALLBACK_ATTEMPTS;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const outcome = await generateGeminiTurnOnce({
        model,
        systemInstruction: params.systemInstruction,
        contents: params.contents,
        tools: params.tools,
      });

      if (outcome.ok) {
        return outcome;
      }

      lastFailure = outcome;

      if (isRetiredModelError(outcome.error)) {
        break;
      }

      if (!outcome.retryable) {
        if (outcome.status === 401 || outcome.status === 403) {
          return outcome;
        }
        break;
      }

      if (attempt < attempts - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  return lastFailure;
};
