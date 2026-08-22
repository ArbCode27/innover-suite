import { env } from "@/lib/config/env";

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

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
  error?: { message?: string };
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const isGeminiConfigured = () => Boolean(env.geminiApiKey);

export const generateGeminiTurn = async (params: {
  model: string;
  systemInstruction: string;
  contents: GeminiContent[];
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}) => {
  if (!env.geminiApiKey) {
    throw new Error("Missing env var: GEMINI_API_KEY");
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new Error(json.error?.message || `Gemini rechazó la solicitud (${response.status}).`);
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

  return { text, functionCalls, modelParts: parts };
};
