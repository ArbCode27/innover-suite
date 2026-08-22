import { FACEBOOK_GRAPH_VERSION, MAX_INBOUND_MEDIA_BYTES } from "@/lib/media/types";

type GraphMediaLookup = {
  url?: string;
  mime_type?: string;
  file_size?: number;
  sha256?: string;
  id?: string;
};

type GraphErrorResponse = {
  error?: { message?: string };
};

const MEDIA_FETCH_TIMEOUT_MS = 15_000;

const createTimeoutSignal = () => {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);
  return controller.signal;
};

const extensionFromMime = (mimeType: string | null, fallbackUrl?: string | null) => {
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return "jpg";
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("gif")) return "gif";
  if (mimeType?.includes("mp4")) return "mp4";
  if (mimeType?.includes("quicktime")) return "mov";
  if (mimeType?.includes("webm")) return "webm";
  if (mimeType?.includes("ogg")) return "ogg";
  if (mimeType?.includes("mpeg") || mimeType?.includes("mp3")) return "mp3";
  if (mimeType?.includes("aac") || mimeType?.includes("m4a")) return "m4a";
  if (mimeType?.includes("wav")) return "wav";
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("msword")) return "doc";
  if (mimeType?.includes("officedocument.wordprocessingml")) return "docx";
  if (mimeType?.includes("spreadsheet")) return "xlsx";
  if (fallbackUrl) {
    try {
      const pathname = new URL(fallbackUrl).pathname;
      const ext = pathname.split(".").pop();
      if (ext && ext.length <= 5) return ext.toLowerCase();
    } catch {
      return "bin";
    }
  }
  return "bin";
};

export type DownloadedMedia = {
  bytes: Uint8Array;
  mimeType: string | null;
  fileName: string;
  sizeBytes: number;
};

const readResponseBytes = async (response: Response): Promise<Uint8Array> => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_INBOUND_MEDIA_BYTES) {
    throw new Error("El archivo supera el tamaño máximo permitido.");
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > MAX_INBOUND_MEDIA_BYTES) {
    throw new Error("El archivo supera el tamaño máximo permitido.");
  }

  return buffer;
};

export const downloadMediaFromUrl = async (
  url: string,
  accessToken?: string | null,
): Promise<DownloadedMedia> => {
  const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  let response = await fetch(url, { headers, signal: createTimeoutSignal(), redirect: "follow" });

  if (response.status === 401 || response.status === 403) {
    response = await fetch(url, { signal: createTimeoutSignal(), redirect: "follow" });
  }

  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo (${response.status}).`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || null;
  const bytes = await readResponseBytes(response);
  const fileName = `media.${extensionFromMime(mimeType, url)}`;

  return { bytes, mimeType, fileName, sizeBytes: bytes.byteLength };
};

export const resolveWhatsappMediaUrl = async (mediaId: string, accessToken: string) => {
  const url = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${encodeURIComponent(mediaId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: createTimeoutSignal(),
  });
  const json = (await response.json()) as GraphMediaLookup & GraphErrorResponse;

  if (!response.ok || !json.url) {
    throw new Error(json.error?.message || `No se pudo resolver el media id (${response.status}).`);
  }

  return {
    url: json.url,
    mimeType: json.mime_type ?? null,
    sizeBytes: typeof json.file_size === "number" ? json.file_size : null,
  };
};
