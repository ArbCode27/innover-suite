import type { MetaChannel } from "@/types/domain";

const INSTAGRAM_GRAPH_VERSION = "v26.0";
const FACEBOOK_GRAPH_VERSION = "v26.0";

type AttachmentKind = "image" | "video" | "audio" | "document";

export type MetaOutboundPayload = {
  channel: MetaChannel;
  accessToken: string;
  accountId: string;
  recipientId: string;
  text?: string;
  mediaUrl?: string;
  attachmentKind?: AttachmentKind;
};

export type MetaOutboundResult =
  | { ok: true; externalMessageId: string | null }
  | { ok: false; status: number; errorMessage: string };

type GraphMessageResponse = {
  message_id?: string;
  messages?: Array<{ id?: string }>;
};

type GraphErrorResponse = {
  error?: {
    message?: string;
    error_user_msg?: string;
    code?: number;
    error_subcode?: number;
  };
};

const ATTACHMENT_TYPE_BY_KIND: Record<AttachmentKind, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  document: "file",
};

const parseGraphError = async (response: Response) => {
  const rawBody = await response.text();
  try {
    const json = JSON.parse(rawBody) as GraphErrorResponse;
    return (
      json.error?.error_user_msg ||
      json.error?.message ||
      `Meta rechazó el envío (${response.status}).`
    );
  } catch {
    return `Meta rechazó el envío (${response.status}).`;
  }
};

const postGraphMessage = async (
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<MetaOutboundResult> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: await parseGraphError(response),
    };
  }

  const json = (await response.json()) as GraphMessageResponse;
  return {
    ok: true,
    externalMessageId: json.message_id || json.messages?.[0]?.id || null,
  };
};

const buildInstagramMessageBody = (payload: MetaOutboundPayload, useAttachment: boolean) => {
  if (useAttachment && payload.mediaUrl) {
    return {
      recipient: { id: payload.recipientId },
      message: {
        attachment: {
          type: ATTACHMENT_TYPE_BY_KIND[payload.attachmentKind ?? "document"],
          payload: { url: payload.mediaUrl },
        },
      },
    };
  }

  return {
    recipient: { id: payload.recipientId },
    message: { text: payload.text ?? "" },
  };
};

const sendInstagramMessage = async (payload: MetaOutboundPayload): Promise<MetaOutboundResult> => {
  const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/messages`;

  if (payload.mediaUrl) {
    const attachmentResult = await postGraphMessage(
      url,
      payload.accessToken,
      buildInstagramMessageBody(payload, true),
    );
    if (!attachmentResult.ok || !payload.text) {
      return attachmentResult;
    }
  }

  if (payload.text) {
    return postGraphMessage(url, payload.accessToken, buildInstagramMessageBody(payload, false));
  }

  return { ok: false, status: 400, errorMessage: "El mensaje no tiene texto ni archivo." };
};

const sendMessengerMessage = async (payload: MetaOutboundPayload): Promise<MetaOutboundResult> => {
  const url = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/messages`;

  if (payload.mediaUrl) {
    const attachmentResult = await postGraphMessage(url, payload.accessToken, {
      recipient: { id: payload.recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: ATTACHMENT_TYPE_BY_KIND[payload.attachmentKind ?? "document"],
          payload: { url: payload.mediaUrl, is_reusable: true },
        },
      },
    });
    if (!attachmentResult.ok || !payload.text) {
      return attachmentResult;
    }
  }

  if (payload.text) {
    return postGraphMessage(url, payload.accessToken, {
      recipient: { id: payload.recipientId },
      messaging_type: "RESPONSE",
      message: { text: payload.text },
    });
  }

  return { ok: false, status: 400, errorMessage: "El mensaje no tiene texto ni archivo." };
};

const sendWhatsappMessage = async (payload: MetaOutboundPayload): Promise<MetaOutboundResult> => {
  const url = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${payload.accountId}/messages`;

  if (payload.mediaUrl) {
    const type = payload.attachmentKind === "image"
      ? "image"
      : payload.attachmentKind === "video"
        ? "video"
        : payload.attachmentKind === "audio"
          ? "audio"
          : "document";
    const attachmentResult = await postGraphMessage(url, payload.accessToken, {
      messaging_product: "whatsapp",
      to: payload.recipientId,
      type,
      [type]: { link: payload.mediaUrl },
    });
    if (!attachmentResult.ok || !payload.text) {
      return attachmentResult;
    }
  }

  if (payload.text) {
    return postGraphMessage(url, payload.accessToken, {
      messaging_product: "whatsapp",
      to: payload.recipientId,
      type: "text",
      text: { body: payload.text, preview_url: false },
    });
  }

  return { ok: false, status: 400, errorMessage: "El mensaje no tiene texto ni archivo." };
};

export const sendMetaOutboundMessage = async (
  payload: MetaOutboundPayload,
): Promise<MetaOutboundResult> => {
  if (payload.channel === "instagram") {
    return sendInstagramMessage(payload);
  }

  if (payload.channel === "messenger") {
    return sendMessengerMessage(payload);
  }

  return sendWhatsappMessage(payload);
};
