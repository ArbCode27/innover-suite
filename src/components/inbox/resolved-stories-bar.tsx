"use client";

import { useMemo } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Camera, CheckCircle2, MessageCircle, MessagesSquare, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { InboxConversation } from "@/app/(suite)/inbox/types";
import { CHANNEL_BADGE_CLASSNAMES, CHANNEL_LABELS } from "@/lib/contacts/display";
import { cn } from "@/lib/utils";

type ResolvedStoriesBarProps = {
  resolvedConversations: InboxConversation[];
  activeConversationId?: number | null;
  onSelectStory: (conversation: InboxConversation) => void;
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

const formatStoryTime = (isoString: string | null | undefined) => {
  if (!isoString) return "";
  try {
    const date = parseISO(isoString);
    const distance = formatDistanceToNow(date, { addSuffix: false, locale: es });
    return distance
      .replace("alrededor de ", "")
      .replace("hace ", "")
      .replace("menos de un minuto", "1m")
      .replace(" horas", "h")
      .replace(" hora", "h")
      .replace(" minutos", "m")
      .replace(" minuto", "m")
      .replace(" días", "d")
      .replace(" día", "d")
      .replace(" meses", "mes")
      .replace(" mes", "mes");
  } catch {
    return "";
  }
};

export const ResolvedStoriesBar = ({
  resolvedConversations,
  activeConversationId,
  onSelectStory,
}: ResolvedStoriesBarProps) => {
  const stories = useMemo(() => {
    // Tomar las conversaciones resueltas más recientes (máximo 20 para el carrusel de historias)
    return [...resolvedConversations]
      .sort((a, b) => {
        const timeA = Date.parse(a.resolvedAt || a.updatedAt || "");
        const timeB = Date.parse(b.resolvedAt || b.updatedAt || "");
        return timeB - timeA;
      })
      .slice(0, 20);
  }, [resolvedConversations]);

  if (!stories.length) return null;

  return (
    <div className="border-b border-primary/10 bg-card/40 px-3 py-2.5 backdrop-blur-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          Historias de chats culminados
        </span>
        <Badge variant="outline" className="h-5 border-emerald-500/30 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
          {stories.length} archivadas
        </Badge>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-3 py-1">
          {stories.map((conversation) => {
            const isSelected = activeConversationId === conversation.id;
            const ChannelIcon = resolveChannelIcon(conversation.channel);
            const timeAgo = formatStoryTime(conversation.resolvedAt || conversation.updatedAt);
            const isSuccessful = conversation.resolutionOutcome !== "unresolved";

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectStory(conversation)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl p-1 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  isSelected && "scale-105",
                )}
                title={`${conversation.contactName} - ${conversation.resolutionReason || "Conversación culminada"}`}
              >
                {/* Anillo de Historia */}
                <div
                  className={cn(
                    "relative flex size-13 items-center justify-center rounded-full p-[2.5px] transition-transform group-hover:scale-105",
                    isSuccessful
                      ? "bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-xs shadow-emerald-500/20"
                      : "bg-gradient-to-tr from-amber-500 via-orange-400 to-yellow-400 shadow-xs shadow-amber-500/20",
                  )}
                >
                  <Avatar className="size-full border-2 border-background">
                    <AvatarFallback className="bg-muted text-xs font-bold text-foreground">
                      {resolveInitials(conversation.contactName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Badge de canal en miniatura */}
                  <span
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-background shadow-xs",
                      CHANNEL_BADGE_CLASSNAMES[conversation.channel],
                    )}
                    aria-label={CHANNEL_LABELS[conversation.channel]}
                  >
                    <ChannelIcon className="size-2.5" />
                  </span>
                </div>

                {/* Nombre de contacto y tiempo */}
                <div className="w-16 truncate text-center">
                  <p className="truncate text-[11px] font-medium leading-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {conversation.contactName.split(" ")[0]}
                  </p>
                  {timeAgo ? (
                    <span className="block text-[10px] text-muted-foreground">{timeAgo}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
};
