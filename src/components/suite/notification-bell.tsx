"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { BrowserNotificationsControls } from "@/components/suite/browser-notifications-controls";
import { markNotificationsReadAction } from "@/lib/notifications/actions";
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
            <DropdownMenuItem key={item.id} asChild>
              <Link href={item.href || "/home"} className={!item.readAt ? "font-medium" : ""}>
                <span>
                  <span className="block">{item.title}</span>
                  {item.body ? <span className="block text-xs text-muted-foreground">{item.body}</span> : null}
                </span>
              </Link>
            </DropdownMenuItem>
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
