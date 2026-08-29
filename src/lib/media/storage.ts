import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  KNOWLEDGE_IMAGES_BUCKET,
  MESSAGE_ATTACHMENTS_BUCKET,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/media/types";

const safeFileName = (fileName: string) => fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const orgImagePath = (organizationId: number, fileName: string) =>
  `org/${organizationId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;

export const buildKnowledgeImagePath = (params: { organizationId: number; fileName: string }) =>
  orgImagePath(params.organizationId, params.fileName);

export const buildProductImagePath = (params: { organizationId: number; fileName: string }) =>
  orgImagePath(params.organizationId, params.fileName);

export const buildMessageStoragePath = (params: {
  organizationId: number;
  conversationId: number;
  messageId: number;
  fileName: string;
}) =>
  `org/${params.organizationId}/conversations/${params.conversationId}/${params.messageId}/${crypto.randomUUID()}-${safeFileName(params.fileName)}`;

export const uploadPublicMedia = async (params: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  mimeType: string | null;
}) => {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(params.bucket).upload(params.path, params.bytes, {
    contentType: params.mimeType || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "No se pudo guardar el archivo en Storage.");
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(params.bucket).getPublicUrl(params.path);

  return publicUrl;
};

export const uploadMessageMedia = async (params: {
  path: string;
  bytes: Uint8Array;
  mimeType: string | null;
}) =>
  uploadPublicMedia({
    bucket: MESSAGE_ATTACHMENTS_BUCKET,
    path: params.path,
    bytes: params.bytes,
    mimeType: params.mimeType,
  });

export const removeStoredMedia = async (params: { bucket: string; path: string; fallbackBuckets?: string[] }) => {
  const admin = getSupabaseAdminClient();
  const buckets = [params.bucket, ...(params.fallbackBuckets ?? [])];

  for (const bucket of buckets) {
    await admin.storage.from(bucket).remove([params.path]);
  }
};

export const removeProductImage = async (path: string) =>
  removeStoredMedia({
    bucket: PRODUCT_IMAGES_BUCKET,
    path,
    fallbackBuckets: [MESSAGE_ATTACHMENTS_BUCKET],
  });

export const removeKnowledgeImage = async (path: string) =>
  removeStoredMedia({
    bucket: KNOWLEDGE_IMAGES_BUCKET,
    path,
    fallbackBuckets: [MESSAGE_ATTACHMENTS_BUCKET],
  });

export const downloadStoredMessageMedia = async (path: string) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || "No se pudo leer el archivo almacenado.");
  }

  return new Uint8Array(await data.arrayBuffer());
};
