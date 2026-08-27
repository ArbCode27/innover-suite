"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NotificationBell } from "@/components/suite/notification-bell";
import type { NotificationRecord } from "@/lib/notifications/board";

export const DESKTOP_NOTIFICATION_SLOT_ID = "suite-notification-slot-desktop";
export const MOBILE_NOTIFICATION_SLOT_ID = "suite-notification-slot-mobile";

const DESKTOP_MEDIA = "(min-width: 768px)";

type NotificationBellHostProps = {
  organizationId: number;
  initialNotifications: NotificationRecord[];
};

export const NotificationBellHost = ({ organizationId, initialNotifications }: NotificationBellHostProps) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA);

    const handlePlacement = () => {
      const slotId = media.matches ? DESKTOP_NOTIFICATION_SLOT_ID : MOBILE_NOTIFICATION_SLOT_ID;
      setTarget(document.getElementById(slotId));
    };

    handlePlacement();
    media.addEventListener("change", handlePlacement);
    return () => media.removeEventListener("change", handlePlacement);
  }, []);

  if (!target) return null;

  return createPortal(
    <NotificationBell organizationId={organizationId} initialNotifications={initialNotifications} />,
    target,
  );
};
