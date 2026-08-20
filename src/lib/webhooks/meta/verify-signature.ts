import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

const SIGNATURE_PREFIX = "sha256=";

type SecretName = "metaAppSecret" | "instagramAppSecret";

type CandidateResult = {
  secretName: SecretName;
  configured: boolean;
  fingerprint: string | null;
  providedLength: number;
  expectedLength: number | null;
  lengthMatches: boolean;
  matches: boolean;
};

type SignatureDiagnostics = {
  isValid: boolean;
  reason:
    | "valid"
    | "missing_header"
    | "invalid_header_prefix"
    | "invalid_header_hex"
    | "missing_secrets"
    | "no_secret_match";
  matchedSecret: SecretName | null;
  hasHeader: boolean;
  headerPrefix: string | null;
  headerSignatureLength: number;
  candidates: CandidateResult[];
};

const hexToBuffer = (value: string) => {
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
    return null;
  }

  return Buffer.from(value, "hex");
};

const fingerprintSecret = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex").slice(0, 10);

export const getSignatureDiagnostics = (
  rawBody: string,
  signatureHeader: string | null,
): SignatureDiagnostics => {
  const hasHeader = Boolean(signatureHeader);
  if (!signatureHeader) {
    return {
      isValid: false,
      reason: "missing_header",
      matchedSecret: null,
      hasHeader,
      headerPrefix: null,
      headerSignatureLength: 0,
      candidates: [],
    };
  }

  const headerPrefix = signatureHeader.slice(0, SIGNATURE_PREFIX.length);
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return {
      isValid: false,
      reason: "invalid_header_prefix",
      matchedSecret: null,
      hasHeader,
      headerPrefix,
      headerSignatureLength: 0,
      candidates: [],
    };
  }

  const provided = hexToBuffer(signatureHeader.slice(SIGNATURE_PREFIX.length));
  if (!provided) {
    return {
      isValid: false,
      reason: "invalid_header_hex",
      matchedSecret: null,
      hasHeader,
      headerPrefix,
      headerSignatureLength: signatureHeader.slice(SIGNATURE_PREFIX.length).length,
      candidates: [],
    };
  }

  const candidatesInput: Array<{ secretName: SecretName; value: string }> = [
    { secretName: "metaAppSecret", value: env.metaAppSecret },
    { secretName: "instagramAppSecret", value: env.instagramAppSecret },
  ];

  const candidates = candidatesInput
    .filter((candidate) => Boolean(candidate.value))
    .map<CandidateResult>((candidate) => {
      const expected = createHmac("sha256", candidate.value).update(rawBody, "utf8").digest();
      const lengthMatches = provided.length === expected.length;
      const matches = lengthMatches && timingSafeEqual(provided, expected);

      return {
        secretName: candidate.secretName,
        configured: true,
        fingerprint: fingerprintSecret(candidate.value),
        providedLength: provided.length,
        expectedLength: expected.length,
        lengthMatches,
        matches,
      };
    });

  if (candidates.length === 0) {
    return {
      isValid: false,
      reason: "missing_secrets",
      matchedSecret: null,
      hasHeader,
      headerPrefix,
      headerSignatureLength: signatureHeader.slice(SIGNATURE_PREFIX.length).length,
      candidates: [],
    };
  }

  const matched = candidates.find((candidate) => candidate.matches);
  if (!matched) {
    return {
      isValid: false,
      reason: "no_secret_match",
      matchedSecret: null,
      hasHeader,
      headerPrefix,
      headerSignatureLength: signatureHeader.slice(SIGNATURE_PREFIX.length).length,
      candidates,
    };
  }

  return {
    isValid: true,
    reason: "valid",
    matchedSecret: matched.secretName,
    hasHeader,
    headerPrefix,
    headerSignatureLength: signatureHeader.slice(SIGNATURE_PREFIX.length).length,
    candidates,
  };
};

export const verifyMetaSignature = (rawBody: string, signatureHeader: string | null) => {
  const diagnostics = getSignatureDiagnostics(rawBody, signatureHeader);
  return diagnostics.isValid;
};
