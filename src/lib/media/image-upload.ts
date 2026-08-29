import { KNOWLEDGE_IMAGE_MIME_TYPES, MAX_KNOWLEDGE_IMAGE_BYTES } from "@/lib/media/types";

export const isUploadedImageFile = (value: FormDataEntryValue | null): value is File =>
  value != null && typeof value === "object" && "arrayBuffer" in value && "size" in value && "type" in value;

export const readCatalogImageFile = async (value: FormDataEntryValue | null) => {
  if (!isUploadedImageFile(value) || value.size <= 0) {
    return { file: null as null };
  }

  if (value.size > MAX_KNOWLEDGE_IMAGE_BYTES) {
    return { error: "La imagen no puede superar 5 MB." };
  }

  const mimeType = value.type === "image/jpg" ? "image/jpeg" : value.type;
  if (!KNOWLEDGE_IMAGE_MIME_TYPES.includes(mimeType as (typeof KNOWLEDGE_IMAGE_MIME_TYPES)[number])) {
    return { error: "Usa JPG, PNG o WebP." };
  }

  return {
    file: {
      bytes: new Uint8Array(await value.arrayBuffer()),
      mimeType,
      fileName: value.name || "imagen.jpg",
    },
  };
};
