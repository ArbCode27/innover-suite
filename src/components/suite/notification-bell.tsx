"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { BrowserNotificationsControls } from "@/components/suite/browser-notifications-controls";
import { deleteNotificationAction, markNotificationsReadAction } from "@/lib/notifications/actions";
import type { NotificationRecord } from "@/lib/notifications/board";
import { useBrowserNotifications } from "@/lib/notifications/use-browser-notifications";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationBellProps = {
  organizationId: number;
  initialNotifications: NotificationRecord[];
};

export const NotificationBell = ({ organizationId, initialNotifications }: NotificationBellProps) => {
  const [items, setItems] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const { notifyFromRecord } = useBrowserNotifications();
  const notifyFromRecordRef = useRef(notifyFromRecord);
  notifyFromRecordRef.current = notifyFromRecord;
  const unread = items.filter((item) => !item.readAt).length;

  useEffect(() => {
    setItems(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const row = payload.new as {
            id: number;
            kind: string;
            title: string;
            body: string | null;
            href: string | null;
            read_at: string | null;
            created_at: string;
          };
          const incoming = {
            id: row.id,
            kind: row.kind,
            title: row.title,
            body: row.body,
            href: row.href,
            readAt: row.read_at,
            createdAt: row.created_at,
          };
          setItems((current) => [incoming, ...current].slice(0, 30));
          notifyFromRecordRef.current(incoming);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          const id = (payload.old as { id?: number } | null)?.id;
          if (!id) return;
          setItems((current) => current.filter((item) => item.id !== id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const handleMarkRead = () => {
    startTransition(async () => {
      await markNotificationsReadAction();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    });
  };

  const handleDeleteNotification = (notificationId: number) => {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== notificationId));
    startTransition(async () => {
      const result = await deleteNotificationAction(notificationId);
      if (result.error) {
        setItems(previous);
        toastActionError(result);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Notificaciones" className="relative">
          <Bell className="size-4" />
          {unread ? (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notificaciones
          <Button type="button" size="sm" variant="ghost" disabled={isPending || !unread} onClick={handleMarkRead}>
            Marcar leídas
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length ? (
          items.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-1 rounded-md px-1.5 py-1.5 hover:bg-accent"
            >
              <Link
                href={item.href || "/home"}
                className={`min-w-0 flex-1 outline-none ${!item.readAt ? "font-medium" : ""}`}
              >
                <span className="block text-sm">{item.title}</span>
                {item.body ? <span className="block text-xs text-muted-foreground">{item.body}</span> : null}
              </Link>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Eliminar aviso: ${item.title}`}
                disabled={isPending}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDeleteNotification(item.id);
                }}
              >
                <X />
              </Button>
            </div>
          ))
        ) : (
          <DropdownMenuItem disabled>Sin avisos</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <div
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <BrowserNotificationsControls compact />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
