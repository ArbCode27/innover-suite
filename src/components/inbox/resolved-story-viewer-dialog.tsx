"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  MessagesSquare,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InboxConversation } from "@/app/(suite)/inbox/types";
import { CHANNEL_BADGE_CLASSNAMES, CHANNEL_LABELS } from "@/lib/contacts/display";
import { cn } from "@/lib/utils";

type ResolvedStoryViewerDialogProps = {
  conversation: InboxConversation | null;
  stories: InboxConversation[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: number) => void;
  onReopenConversation: (id: number) => void;
};

const resolveInitials = (name: string) => {
  const words = name.replace(/^@/, "").trim().split(" ").filter(Boolean);
  if (!words.length) return "SN";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
};

const resolveChannelIcon = (channel: InboxConversation["channel"]) => {
  if (channel === "instagram") return Camera;
  if (channel === "messenger") return MessagesSquare;
  return MessageCircle;
};

const formatResolutionDate = (isoString: string | null | undefined) => {
  if (!isoString) return "Fecha no especificada";
  try {
    return format(parseISO(isoString), "EEEE d 'de' MMMM, yyyy · h:mm a", { locale: es });
  } catch {
    return isoString;
  }
};

export const ResolvedStoryViewerDialog = ({
  conversation,
  stories,
  isOpen,
  onOpenChange,
  onSelectConversation,
  onReopenConversation,
}: ResolvedStoryViewerDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (conversation && stories.length) {
      const idx = stories.findIndex((item) => item.id === conversation.id);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [conversation, stories]);

  const current = stories[currentIndex] || conversation;

  if (!current) return null;

  const ChannelIcon = resolveChannelIcon(current.channel);
  const isSuccessful = current.resolutionOutcome !== "unresolved";

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleReopen = () => {
    startTransition(() => {
      onReopenConversation(current.id);
      onOpenChange(false);
    });
  };

  const handleGoToChat = () => {
    onSelectConversation(current.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-primary/20 bg-card/95 p-0 sm:max-w-md backdrop-blur-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Historia de conversación archivada</DialogTitle>
        </DialogHeader>

        {/* Barra superior de progreso estilo historias */}
        {stories.length > 1 ? (
          <div className="flex gap-1 px-4 pt-3">
            {stories.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  idx === currentIndex
                    ? isSuccessful
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : idx < currentIndex
                      ? "bg-primary/40"
                      : "bg-muted",
                )}
              />
            ))}
          </div>
        ) : null}

        {/* Encabezado del contacto */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full p-[2px]",
                isSuccessful
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-400"
                  : "bg-gradient-to-tr from-amber-500 to-yellow-400",
              )}
            >
              <Avatar className="size-full border-2 border-background">
                <AvatarFallback className="text-xs font-bold">
                  {resolveInitials(current.contactName)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-background shadow-xs",
                  CHANNEL_BADGE_CLASSNAMES[current.channel],
                )}
              >
                <ChannelIcon className="size-2.5" />
              </span>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current.contactName}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{CHANNEL_LABELS[current.channel]}</span>
                <span>•</span>
                <span className="capitalize">{formatResolutionDate(current.resolvedAt || current.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo de la historia */}
        <div className="space-y-4 p-5">
          {/* Tarjeta de resultado */}
          <div
            className={cn(
              "rounded-2xl border p-4 space-y-2.5 transition-colors",
              isSuccessful
                ? "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15"
                : "border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 font-medium",
                  isSuccessful
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/40 text-amber-700 dark:text-amber-300",
                )}
              >
                <CheckCircle2 className="size-3.5" />
                {isSuccessful ? "Culminada con éxito" : "Culminada sin concretar"}
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                Estado: Archivado
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground">Motivo de cierre:</p>
              <p className="text-sm font-medium text-foreground/90">
                {current.resolutionReason || "Atención completada"}
              </p>
            </div>

            {current.resolutionSummary ? (
              <div className="rounded-xl bg-background/60 p-2.5 text-xs text-foreground/80 italic border border-border/40">
                &ldquo;{current.resolutionSummary}&rdquo;
              </div>
            ) : null}
          </div>

          {/* Último mensaje registrado */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Clock className="size-3" />
              Último mensaje en el chat
            </span>
            <p className="text-xs leading-relaxed text-foreground/80 line-clamp-3">
              {current.lastMessagePreview || "Sin mensajes registrados"}
            </p>
          </div>
        </div>

        {/* Acciones inferiores */}
        <div className="flex items-center justify-between border-t border-border/50 bg-background/50 px-4 py-3">
          <div className="flex items-center gap-1">
            {stories.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  aria-label="Historia anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {currentIndex + 1} / {stories.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleNext}
                  disabled={currentIndex >= stories.length - 1}
                  aria-label="Siguiente historia"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleGoToChat}
            >
              <ExternalLink className="size-3.5" />
              <span>Ver chat</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={handleReopen}
              disabled={isPending}
            >
              <RotateCcw className="size-3.5" />
              <span>Reabrir</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
