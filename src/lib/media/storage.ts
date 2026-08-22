import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/media/types";

export const buildMessageStoragePath = (params: {
  organizationId: number;
  conversationId: number;
  messageId: number;
  fileName: string;
}) => {
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `org/${params.organizationId}/conversations/${params.conversationId}/${params.messageId}/${crypto.randomUUID()}-${safeName}`;
};

export const uploadMessageMedia = async (params: {
  path: string;
  bytes: Uint8Array;
  mimeType: string | null;
}) => {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).upload(params.path, params.bytes, {
    contentType: params.mimeType || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "No se pudo guardar el archivo en Storage.");
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).getPublicUrl(params.path);

  return publicUrl;
};

export const downloadStoredMessageMedia = async (path: string) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || "No se pudo leer el archivo almacenado.");
  }

  return new Uint8Array(await data.arrayBuffer());
};
