"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  CheckCircle2,
  FileText,
  Headphones,
  ImageIcon,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  SendHorizontal,
  Smile,
  Video,
} from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendConversationMessageAction, takeConversationAction } from "./actions";
import type { AttachmentKind, InboxConversation, InboxFilter, InboxMessage } from "./types";

type InboxPanelProps = {
  organizationName: string;
  currentUserId: string | null;
  initialConversations: InboxConversation[];
  initialMessagesByConversation: Record<number, InboxMessage[]>;
};

type ComposerAttachment = {
  kind: AttachmentKind;
  file: File;
};

const inboxFilters: Array<{ key: InboxFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "No leídas" },
  { key: "ai", label: "Bot IA" },
  { key: "human", label: "Humano" },
];

const emojiOptions = ["😀", "😍", "😂", "🔥", "👍", "🙏", "🎉", "📌", "👀", "✅"];
const attachmentBucket = "message-attachments";

const attachmentAccept: Record<AttachmentKind, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
};
const previewCharLimit = 72;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const resolveModeLabel = (mode: InboxConversation["mode"]) => (mode === "ai" ? "IA" : "Humano");
const resolveStatusLabel = (status: InboxConversation["status"]) => {
  if (status === "in_progress") return "En curso";
  if (status === "resolved") return "Resuelta";
  return "Abierta";
};

const resolveAttachmentLabel = (kind: AttachmentKind | null) => {
  if (!kind) return "Archivo";
  if (kind === "image") return "Imagen";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "Documento";
};

const resolveAttachmentIcon = (kind: AttachmentKind | null) => {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "audio") return Mic;
  return FileText;
};

const resolveInitials = (name: string) => {
  const words = name
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "SN";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
};

const limitPreview = (text: string) => {
  if (text.length <= previewCharLimit) return text;
  return `${text.slice(0, previewCharLimit - 1).trimEnd()}…`;
};

const normalizeMessage = (row: {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  sender_type: "contact" | "agent" | "ai" | "system";
  content: string | null;
  media_url: string | null;
  metadata: unknown;
  created_at: string;
}): InboxMessage => {
  const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};

  const attachmentKindValue = metadata["attachment_kind"];
  const attachmentNameValue = metadata["attachment_name"];

  const attachmentKind: AttachmentKind | null =
    typeof attachmentKindValue === "string" &&
    ["image", "video", "audio", "document"].includes(attachmentKindValue)
      ? (attachmentKindValue as AttachmentKind)
      : null;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    senderType: row.sender_type,
    content: row.content,
    mediaUrl: row.media_url,
    createdAt: row.created_at,
    attachmentKind,
    attachmentName: typeof attachmentNameValue === "string" ? attachmentNameValue : null,
  };
};

export const InboxPanel = ({
  organizationName,
  currentUserId,
  initialConversations,
  initialMessagesByConversation,
}: InboxPanelProps) => {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, InboxMessage[]>>(
    initialMessagesByConversation,
  );
  const [composerText, setComposerText] = useState("");
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAttachmentKind, setPendingAttachmentKind] = useState<AttachmentKind>("document");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const filteredConversations = useMemo(() => {
    const loweredTerm = searchTerm.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "ai") return conversation.mode === "ai";
        if (activeFilter === "human") return conversation.mode === "human";
        return conversation.unreadCount > 0;
      })
      .filter((conversation) => {
        if (!loweredTerm) return true;
        const haystack = `${conversation.contactName} ${conversation.contactPhone ?? ""} ${conversation.lastMessagePreview}`.toLowerCase();
        return haystack.includes(loweredTerm);
      });
  }, [activeFilter, conversations, searchTerm]);

  const activeConversationId = useMemo(() => {
    if (!filteredConversations.length) return null;
    if (selectedConversationId && filteredConversations.some((item) => item.id === selectedConversationId)) {
      return selectedConversationId;
    }
    return filteredConversations[0]!.id;
  }, [filteredConversations, selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const selectedMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];

  const loadMessages = useCallback(async (conversationId: number) => {
    setIsLoadingMessages(true);
    setComposerError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(250);

    if (error) {
      setComposerError(`No se pudieron cargar los mensajes: ${error.message}`);
      setIsLoadingMessages(false);
      return;
    }

    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (data ?? []).map(normalizeMessage),
    }));
    setIsLoadingMessages(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversationId, selectedMessages.length]);

  const handleSelectConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    if (!messagesByConversation[conversationId]) {
      void loadMessages(conversationId);
    }
  };

  const handleSelectAttachmentKind = (kind: AttachmentKind) => {
    setPendingAttachmentKind(kind);
    fileInputRef.current?.click();
  };

  const handleAttachmentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setComposerAttachment({ kind: pendingAttachmentKind, file });
    setComposerError(null);
  };

  const handleInsertEmoji = (emoji: string) => {
    setComposerText((current) => `${current}${emoji}`);
  };

  const handleTakeConversation = async () => {
    if (!activeConversationId) return;

    startTransition(async () => {
      const result = await takeConversationAction({ conversationId: activeConversationId });
      if (result.error) {
        setComposerError(result.error);
        return;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                mode: "human",
                status: "in_progress",
                assignedUserId: currentUserId,
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );
      setComposerError(null);
    });
  };

  const uploadAttachment = async (conversationId: number, attachment: ComposerAttachment) => {
    const extension = attachment.file.name.includes(".") ? attachment.file.name.split(".").pop() : "";
    const suffix = extension ? `.${extension}` : "";
    const fileName = `${Date.now()}-${crypto.randomUUID()}${suffix}`;
    const path = `conversations/${conversationId}/${fileName}`;

    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(attachmentBucket)
      .upload(path, attachment.file, { cacheControl: "3600", contentType: attachment.file.type || undefined });

    if (uploadError) {
      throw new Error(
        `No se pudo subir el archivo a Storage. Verifica el bucket "${attachmentBucket}" y permisos RLS. ${uploadError.message}`,
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(attachmentBucket).getPublicUrl(path);

    return publicUrl;
  };

  const handleSendMessage = async () => {
    if (!selectedConversation) return;

    const text = composerText.trim();
    if (!text && !composerAttachment) {
      setComposerError("Escribe un mensaje o adjunta un archivo.");
      return;
    }

    setComposerError(null);
    let mediaUrl: string | undefined;
    const attachmentPayload = composerAttachment;

    try {
      if (composerAttachment) {
        setIsUploadingAttachment(true);
        mediaUrl = await uploadAttachment(selectedConversation.id, composerAttachment);
      }
    } catch (error) {
      const uploadMessage = error instanceof Error ? error.message : "No se pudo subir el archivo.";
      setComposerError(uploadMessage);
      setIsUploadingAttachment(false);
      return;
    } finally {
      setIsUploadingAttachment(false);
    }

    startTransition(async () => {
      const result = await sendConversationMessageAction({
        conversationId: selectedConversation.id,
        content: text || undefined,
        mediaUrl,
        attachmentKind: attachmentPayload?.kind,
        attachmentName: attachmentPayload?.file.name,
        attachmentSize: attachmentPayload?.file.size,
      });

      if (result.error || !result.data?.message) {
        setComposerError(result.error ?? "No se pudo enviar el mensaje.");
        return;
      }

      const sentMessage = result.data.message;
      const now = new Date().toISOString();
      const previewText =
        sentMessage.content?.trim() ||
        `${resolveAttachmentLabel(sentMessage.attachmentKind)} adjunto`;

      setMessagesByConversation((current) => ({
        ...current,
        [selectedConversation.id]: [...(current[selectedConversation.id] ?? []), sentMessage],
      }));

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                mode: "human",
                status: "in_progress",
                assignedUserId: currentUserId,
                lastMessageAt: now,
                updatedAt: now,
                lastMessagePreview: previewText,
                unreadCount: 0,
              }
            : conversation,
        ),
      );

      setComposerText("");
      setComposerAttachment(null);
      setComposerError(null);
    });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const canSend = Boolean(selectedConversation) && !isPending && !isUploadingAttachment;
  const showAudioQuickAction = !composerText.trim() && !composerAttachment;

  return (
    <div className="grid h-[calc(100vh-1.5rem)] max-h-[100vh] gap-3 overflow-hidden md:h-[calc(100vh-2.5rem)] lg:grid-cols-[330px_1fr]">
      <Card className="flex h-full min-h-0 flex-col border-primary/15 bg-card/70">
        <CardHeader className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Conversaciones</CardTitle>
              <CardDescription>{filteredConversations.length} chats en vista</CardDescription>
            </div>
            <Badge variant="outline" className="max-w-32 truncate">
              {organizationName}
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar conversación"
              className="h-8 pl-9"
              placeholder="Buscar por nombre, teléfono o texto"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inboxFilters.map((filter) => (
              <Button
                key={filter.key}
                type="button"
                size="xs"
                variant={activeFilter === filter.key ? "default" : "outline"}
                aria-pressed={activeFilter === filter.key}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 p-0">
          {filteredConversations.length ? (
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {filteredConversations.map((conversation) => {
                  const isSelected = activeConversationId === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? "border-primary/30 bg-primary/10"
                          : "border-primary/10 bg-background/70 hover:bg-accent/70"
                      }`}
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>{resolveInitials(conversation.contactName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{conversation.contactName}</p>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {limitPreview(conversation.lastMessagePreview || "Sin mensajes recientes")}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Badge variant="outline">{conversation.channel}</Badge>
                            <Badge variant="outline">{resolveModeLabel(conversation.mode)}</Badge>
                            {conversation.unreadCount > 0 ? (
                              <Badge>{conversation.unreadCount}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-3">
              <div className="rounded-xl border border-dashed border-primary/20 bg-primary/8 p-4 text-center">
                <p className="font-medium">No hay conversaciones en este filtro</p>
                <p className="mt-2 text-sm text-muted-foreground">Prueba con otra búsqueda o cambia el filtro.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedConversation ? (
        <Card className="flex h-full min-h-0 flex-col border-primary/15 bg-card/70">
          <CardHeader className="border-b border-primary/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarFallback>{resolveInitials(selectedConversation.contactName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedConversation.contactName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedConversation.contactPhone || "Sin teléfono"} · {selectedConversation.channel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{resolveStatusLabel(selectedConversation.status)}</Badge>
                <Badge variant="outline">{resolveModeLabel(selectedConversation.mode)}</Badge>
                {selectedConversation.mode === "ai" ? (
                  <Button type="button" size="xs" variant="outline" onClick={handleTakeConversation} disabled={isPending}>
                    <Headphones />
                    Tomar conversación
                  </Button>
                ) : null}
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Opciones de conversación">
                  <MoreVertical />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <ScrollArea className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.02),transparent_30rem)] px-3 py-3">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cargando conversación...
                </div>
              ) : selectedMessages.length ? (
                <div className="space-y-2.5 pb-1">
                  {selectedMessages.map((message) => {
                    const isOutbound = message.direction === "outbound";
                    const AttachmentIcon = resolveAttachmentIcon(message.attachmentKind);

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                      >
                        <article
                          className={`max-w-[78%] rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                            isOutbound
                              ? "border-primary/30 bg-primary/15 text-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}

                          {message.mediaUrl ? (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-2 py-1 text-xs"
                            >
                              <AttachmentIcon className="size-3.5" />
                              {message.attachmentName || resolveAttachmentLabel(message.attachmentKind)}
                            </a>
                          ) : null}

                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                            <span>{formatTime(message.createdAt)}</span>
                            {isOutbound ? <CheckCircle2 className="size-3" /> : null}
                          </div>
                        </article>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Esta conversación todavía no tiene mensajes.
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-primary/10 p-2">
              {composerAttachment ? (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/8 px-2.5 py-1.5 text-xs">
                  <span className="truncate">
                    {resolveAttachmentLabel(composerAttachment.kind)}: {composerAttachment.file.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setComposerAttachment(null)}
                  >
                    Quitar
                  </Button>
                </div>
              ) : null}

              {composerError ? (
                <p className="mb-2 text-xs text-destructive">{composerError}</p>
              ) : null}

              <div className="flex min-h-12 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Insertar emoji">
                      <Smile />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-auto min-w-0">
                    <DropdownMenuLabel>Emojis</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="grid grid-cols-5 gap-1 p-1">
                      {emojiOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
                          onClick={() => handleInsertEmoji(emoji)}
                        >
                          <span className="text-base">{emoji}</span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Agregar archivo">
                      <Paperclip />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Adjuntar</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => handleSelectAttachmentKind("image")}>
                      <ImageIcon />
                      Imagen
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleSelectAttachmentKind("video")}>
                      <Video />
                      Video
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleSelectAttachmentKind("audio")}>
                      <Mic />
                      Audio
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleSelectAttachmentKind("document")}>
                      <FileText />
                      Documento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  aria-label="Escribe una respuesta"
                  placeholder="Escribe un mensaje..."
                  className="h-9 flex-1"
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={!selectedConversation || isPending || isUploadingAttachment}
                />

                <Button
                  type="button"
                  size="icon"
                  aria-label={showAudioQuickAction ? "Grabar o adjuntar audio" : "Enviar mensaje"}
                  onClick={showAudioQuickAction ? () => handleSelectAttachmentKind("audio") : handleSendMessage}
                  disabled={!canSend}
                >
                  {isPending || isUploadingAttachment ? (
                    <Loader2 className="animate-spin" />
                  ) : showAudioQuickAction ? (
                    <Mic />
                  ) : (
                    <SendHorizontal />
                  )}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={attachmentAccept[pendingAttachmentKind]}
                onChange={handleAttachmentFileChange}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyMetaState
          title="Selecciona una conversación para comenzar"
          description="Cuando selecciones un chat podrás ver el historial y responder como agente humano."
        />
      )}
    </div>
  );
};
