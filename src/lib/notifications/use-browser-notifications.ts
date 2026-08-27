"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationRecord } from "@/lib/notifications/board";
import {
  BROWSER_NOTIFICATIONS_CHANGE_EVENT,
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  readBrowserNotificationOptIn,
  showDesktopNotification,
  writeBrowserNotificationOptIn,
} from "@/lib/notifications/browser";

export type BrowserNotificationUiStatus =
  | "loading"
  | "unsupported"
  | "prompt"
  | "denied"
  | "muted"
  | "active";

type EnableResult = { ok: true } | { ok: false; error: string };

export const useBrowserNotifications = () => {
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [optedIn, setOptedIn] = useState(false);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => {
    setPermission(getBrowserNotificationPermission());
    setOptedIn(readBrowserNotificationOptIn());
    setReady(true);
  }, []);

  useEffect(() => {
    sync();

    const handleChange = () => sync();
    window.addEventListener(BROWSER_NOTIFICATIONS_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);

    if (!isBrowserNotificationSupported() || !navigator.permissions?.query) {
      return () => {
        window.removeEventListener(BROWSER_NOTIFICATIONS_CHANGE_EVENT, handleChange);
        window.removeEventListener("storage", handleChange);
      };
    }

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    void navigator.permissions
      .query({ name: "notifications" })
      .then((status) => {
        if (cancelled) return;
        permissionStatus = status;
        status.onchange = handleChange;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
      window.removeEventListener(BROWSER_NOTIFICATIONS_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [sync]);

  const status: BrowserNotificationUiStatus = !ready
    ? "loading"
    : permission === "unsupported"
      ? "unsupported"
      : permission === "denied"
        ? "denied"
        : permission === "granted" && optedIn
          ? "active"
          : permission === "granted"
            ? "muted"
            : "prompt";

  const handleEnable = useCallback(async (): Promise<EnableResult> => {
    if (!isBrowserNotificationSupported()) {
      return { ok: false, error: "Este navegador no admite avisos de escritorio." };
    }

    const result =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (result !== "granted") {
      writeBrowserNotificationOptIn(false);
      sync();
      return {
        ok: false,
        error:
          result === "denied"
            ? "El navegador bloqueó los avisos. Actívalos en el candado junto a la URL."
            : "No se activaron los avisos.",
      };
    }

    writeBrowserNotificationOptIn(true);
    sync();
    showDesktopNotification({
      title: "Avisos activados",
      body: "Te avisaremos cuando entre un mensaje y no estés viendo el CRM.",
      force: true,
      tag: "innover-suite-enabled",
    });
    return { ok: true };
  }, [sync]);

  const handleMute = useCallback(() => {
    writeBrowserNotificationOptIn(false);
    sync();
  }, [sync]);

  const notifyFromRecord = useCallback(
    (record: Pick<NotificationRecord, "id" | "kind" | "title" | "body" | "href">) => {
      showDesktopNotification({
        title: record.title,
        body: record.body,
        href: record.href,
        tag: record.href ? `innover-${record.kind}-${record.href}` : `innover-${record.kind}-${record.id}`,
        onNavigate: (href) => {
          router.push(href);
        },
      });
    },
    [router],
  );

  return { status, handleEnable, handleMute, notifyFromRecord };
};
