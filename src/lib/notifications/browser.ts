export const BROWSER_NOTIFICATIONS_STORAGE_KEY = "innover.browser-notifications.opt-in";
export const BROWSER_NOTIFICATIONS_CHANGE_EVENT = "innover:browser-notifications";

const APP_NAME = "Innover Suite";

export const isBrowserNotificationSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "Notification" in window &&
  typeof Notification.requestPermission === "function";

export const getBrowserNotificationPermission = (): NotificationPermission | "unsupported" => {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
};

export const readBrowserNotificationOptIn = () => {
  if (typeof window === "undefined" || !isBrowserNotificationSupported()) return false;

  try {
    const stored = window.localStorage.getItem(BROWSER_NOTIFICATIONS_STORAGE_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    return Notification.permission === "granted";
  }

  return Notification.permission === "granted";
};

export const writeBrowserNotificationOptIn = (enabled: boolean) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(BROWSER_NOTIFICATIONS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* Safari private mode may block localStorage */
  }

  window.dispatchEvent(new Event(BROWSER_NOTIFICATIONS_CHANGE_EVENT));
};

export const isDocumentAway = () => {
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible" || !document.hasFocus();
};

export type DesktopNotificationPayload = {
  title: string;
  body?: string | null;
  href?: string | null;
  tag?: string;
  force?: boolean;
  onNavigate?: (href: string) => void;
};

const iconUrl = () => new URL("/favicon.ico", window.location.origin).href;

export const showDesktopNotification = (payload: DesktopNotificationPayload) => {
  if (!isBrowserNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;
  if (!readBrowserNotificationOptIn()) return null;
  if (!payload.force && !isDocumentAway()) return null;

  const icon = iconUrl();
  const notification = new Notification(payload.title || APP_NAME, {
    body: payload.body?.slice(0, 180) || undefined,
    icon,
    badge: icon,
    lang: "es",
    tag: payload.tag ?? "innover-suite",
  });

  notification.onclick = () => {
    notification.close();
    window.focus();
    if (!payload.href) return;
    if (payload.onNavigate) {
      payload.onNavigate(payload.href);
      return;
    }
    window.location.assign(payload.href);
  };

  return notification;
};
