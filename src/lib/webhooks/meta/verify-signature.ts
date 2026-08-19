import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

const SIGNATURE_PREFIX = "sha256=";

const hexToBuffer = (value: string) => {
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
    return null;
  }

  return Buffer.from(value, "hex");
};

export const verifyMetaSignature = (rawBody: string, signatureHeader: string | null) => {
  const appSecret = env.metaAppSecret;
  if (!appSecret) {
    return false;
  }

  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const provided = hexToBuffer(signatureHeader.slice(SIGNATURE_PREFIX.length));
  if (!provided) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
};
