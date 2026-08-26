"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type FacebookLoginResponse = {
  authResponse?: {
    code?: string;
  };
  status?: string;
};

type FacebookSdk = {
  init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras: {
        setup: Record<string, never>;
        sessionInfoVersion: "3";
      };
    },
  ) => void;
};

type StartPayload = {
  status?: string;
  appId?: string;
  configId?: string;
  graphVersion?: string;
  state?: string;
};

type SessionInfo = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const isFacebookOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
};

const parseJsonRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const readSessionInfo = (event: MessageEvent): { eventName: string; session: SessionInfo } | null => {
  if (!isFacebookOrigin(event.origin)) {
    return null;
  }

  const record = parseJsonRecord(event.data);
  if (record?.type !== "WA_EMBEDDED_SIGNUP") {
    return null;
  }

  const payload = parseJsonRecord(record.data) ?? {};
  return {
    eventName: typeof record.event === "string" ? record.event : "",
    session: {
      wabaId: typeof payload.waba_id === "string" ? payload.waba_id : undefined,
      phoneNumberId: typeof payload.phone_number_id === "string" ? payload.phone_number_id : undefined,
      businessId: typeof payload.business_id === "string" ? payload.business_id : undefined,
    },
  };
};

const redirectWithStatus = (status: string) => {
  window.location.assign(`/settings?wa=${encodeURIComponent(status)}#whatsapp`);
};

const loadFacebookSdk = (appId: string, version: string) =>
  new Promise<FacebookSdk>((resolve, reject) => {
    const finish = () => {
      if (!window.FB) {
        reject(new Error("Facebook SDK unavailable"));
        return;
      }
      window.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve(window.FB);
    };

    if (window.FB) {
      finish();
      return;
    }

    window.fbAsyncInit = finish;
    if (document.getElementById("facebook-jssdk")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Facebook SDK failed to load"));
    document.body.appendChild(script);
  });

const loginWithEmbeddedSignup = (sdk: FacebookSdk, configId: string) =>
  new Promise<{ code: string; session: SessionInfo }>((resolve, reject) => {
    let session: SessionInfo = {};
    let settled = false;

    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleMessage);
      run();
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = readSessionInfo(event);
      if (!payload) return;

      if (payload.eventName === "CANCEL") {
        settle(() => reject(new Error("cancelled")));
        return;
      }

      if (payload.eventName === "ERROR") {
        settle(() => reject(new Error("signup_failed")));
        return;
      }

      if (payload.eventName === "FINISH") {
        session = payload.session;
      }
    };

    window.addEventListener("message", handleMessage);

    sdk.login(
      (response) => {
        window.setTimeout(() => {
          settle(() => {
            const code = response.authResponse?.code?.trim();
            if (!code) {
              reject(new Error(response.status === "unknown" ? "cancelled" : "login_failed"));
              return;
            }
            resolve({ code, session });
          });
        }, 400);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
        },
      },
    );
  });

export const WhatsAppConnectButton = () => {
  const [isPending, setIsPending] = useState(false);

  const handleConnectWhatsApp = async () => {
    setIsPending(true);

    try {
      const startResponse = await fetch("/api/auth/whatsapp/start", { cache: "no-store" });
      const startPayload = (await startResponse.json().catch(() => null)) as StartPayload | null;
      if (!startResponse.ok || !startPayload?.appId || !startPayload.configId || !startPayload.state) {
        redirectWithStatus(startPayload?.status || "state_error");
        return;
      }

      const sdk = await loadFacebookSdk(startPayload.appId, startPayload.graphVersion || "v26.0");
      const { code, session } = await loginWithEmbeddedSignup(sdk, startPayload.configId);

      const callbackResponse = await fetch("/api/auth/whatsapp/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          state: startPayload.state,
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
          businessId: session.businessId,
        }),
      });
      const callbackPayload = (await callbackResponse.json().catch(() => null)) as { status?: string } | null;
      redirectWithStatus(callbackPayload?.status || (callbackResponse.ok ? "connected" : "persist_failed"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "login_failed";
      if (message === "cancelled" || message === "signup_failed" || message === "login_failed") {
        redirectWithStatus(message);
        return;
      }
      redirectWithStatus("sdk_failed");
    }
  };

  return (
    <Button
      type="button"
      className="w-full"
      disabled={isPending}
      aria-label={isPending ? "Conectando WhatsApp" : "Conectar WhatsApp"}
      onClick={() => {
        void handleConnectWhatsApp();
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : null}
      {isPending ? "Conectando…" : "Conectar WhatsApp"}
    </Button>
  );
};
