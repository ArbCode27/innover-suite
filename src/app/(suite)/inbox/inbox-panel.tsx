"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  ImageIcon,
  KanbanSquare,
  Loader2,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  SendHorizontal,
  Smile,
  Sparkles,
  Square,
  UserPlus,
  Video,
} from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { useMobileChrome } from "@/components/suite/mobile-nav";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { CHANNEL_BADGE_CLASSNAMES, CHANNEL_LABELS } from "@/lib/contacts/display";
import { attachmentPreviewLabel } from "@/lib/media/parse";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/media/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createFunnelCardFromConversationAction } from "../funnels/actions";
import { sendConversationMessageAction, setConversationModeAction, assignConversationAction, markConversationReadAction } from "./actions";
import { suggestReplyAction } from "@/lib/inbox/suggest";
import { mapConversationListRow, mergeInboxConversations, previewFromMessageRow, type ConversationListRow } from "@/lib/inbox/board";
import { MessageMedia } from "./message-media";
import type { FileAttachmentKind, InboxConversation, InboxFilter, InboxMessage } from "./types";
import { normalizeInboxMessage } from "./types";

type InboxPanelProps = {
  organizationId: number;
  organizationName: string;
  currentUserId: string | null;
  initialConversationId: number | null;
  initialConversations: InboxConversation[];
  initialMessagesByConversation: Record<number, InboxMessage[]>;
  officeClosed?: boolean;
};

type ComposerAttachment = {
  kind: FileAttachmentKind;
  file: File;
  isVoice?: boolean;
};

const inboxFilters: Array<{ key: InboxFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "No leídas" },
  { key: "ai", label: "Bot IA" },
  { key: "human", label: "Humano" },
  { key: "mine", label: "Mías" },
  { key: "unassigned", label: "Cola" },
];

const emojiOptions = ["😀", "😍", "😂", "🔥", "👍", "🙏", "🎉", "📌", "👀", "✅"];
const attachmentBucket = MESSAGE_ATTACHMENTS_BUCKET;

const attachmentAccept: Record<FileAttachmentKind, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
};
const previewCharLimit = 72;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const resolveModeLabel = (mode: InboxConversation["mode"]) => (mode === "ai" ? "IA" : "Humano");

const GeminiIcon = () => {
  const gradientId = `gemini-${useId().replace(/:/g, "")}`;

  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-3.5">
      <defs>
        <linearGradient id={gradientId} x1="4%" y1="8%" x2="96%" y2="92%">
          <stop offset="0%" stopColor="#4B90FF" />
          <stop offset="50%" stopColor="#9B72F0" />
          <stop offset="100%" stopColor="#FF8BCB" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 2c0 5.523 4.477 10 10 10-5.523 0-10 4.477-10 10 0-5.523-4.477-10-10-10 5.523 0 10-4.477 10-10Z"
      />
    </svg>
  );
};
const resolveAttachmentLabel = (kind: FileAttachmentKind | null) =>
  attachmentPreviewLabel(kind ?? "document");

const resolveInitials = (name: string) => {
  const words = name
    .replace(/^@/, "")
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

const resolveChannelIcon = (channel: InboxConversation["channel"]) => {
  if (channel === "instagram") return Camera;
  if (channel === "messenger") return MessagesSquare;
  return MessageCircle;
};

const ChannelBadge = ({ channel }: { channel: InboxConversation["channel"] }) => {
  const Icon = resolveChannelIcon(channel);
  return (
    <Badge
      variant="outline"
      className={cn("h-7 px-2.5 text-[13px] [&>svg]:size-3.5!", CHANNEL_BADGE_CLASSNAMES[channel])}
    >
      <Icon aria-hidden />
      {CHANNEL_LABELS[channel]}
    </Badge>
  );
};

const resolveConversationSubtitle = (conversation: InboxConversation) => {
  const channelLabel = CHANNEL_LABELS[conversation.channel];
  if (conversation.channel === "whatsapp") {
    return [conversation.contactPhone, channelLabel].filter(Boolean).join(" · ");
  }

  const handle = conversation.contactUsername?.trim().replace(/^@/, "") || null;
  return [handle, channelLabel].filter(Boolean).join(" · ");
};

export const InboxPanel = ({
  organizationId,
  organizationName,
  currentUserId,
  initialConversationId,
  initialConversations,
  initialMessagesByConversation,
  officeClosed = false,
}: InboxPanelProps) => {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(initialConversationId);
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(Boolean(initialConversationId));
  const { setHideMobileNav } = useMobileChrome();
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, InboxMessage[]>>(
    initialMessagesByConversation,
  );
  const [composerText, setComposerText] = useState("");
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAttachmentKind, setPendingAttachmentKind] = useState<FileAttachmentKind>("document");
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const markReadInFlightRef = useRef<Set<number>>(new Set());

  const filteredConversations = useMemo(() => {
    const loweredTerm = searchTerm.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "ai") return conversation.mode === "ai";
        if (activeFilter === "human") return conversation.mode === "human";
        if (activeFilter === "mine") return conversation.assignedUserId === currentUserId;
        if (activeFilter === "unassigned") return conversation.mode === "human" && !conversation.assignedUserId;
        return conversation.unreadCount > 0;
      })
      .filter((conversation) => {
        if (!loweredTerm) return true;
        const haystack = `${conversation.contactName} ${conversation.contactUsername ?? ""} ${conversation.contactPhone ?? ""} ${CHANNEL_LABELS[conversation.channel]} ${conversation.lastMessagePreview}`.toLowerCase();
        return haystack.includes(loweredTerm);
      });
  }, [activeFilter, conversations, currentUserId, searchTerm]);

  const activeConversationId = useMemo(() => {
    if (!selectedConversationId) return null;
    if (filteredConversations.some((item) => item.id === selectedConversationId)) {
      return selectedConversationId;
    }
    return null;
  }, [filteredConversations, selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const selectedMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];

  activeConversationIdRef.current = activeConversationId;

  const markConversationRead = useCallback((conversationId: number) => {
    if (markReadInFlightRef.current.has(conversationId)) {
      return;
    }

    markReadInFlightRef.current.add(conversationId);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    );

    void markConversationReadAction(conversationId).finally(() => {
      markReadInFlightRef.current.delete(conversationId);
    });
  }, []);

  const loadInboxConversations = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, contact_id, channel, status, mode, assigned_user_id, updated_at, last_message_at, metadata, customer_phone, contacts(full_name, phone, metadata)",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return;
    }

    const mapped = ((data ?? []) as unknown as ConversationListRow[])
      .map((row) => mapConversationListRow(row))
      .filter((row): row is InboxConversation => Boolean(row));

    setConversations(mapped);
  }, [organizationId]);

  const applyConversationChange = useCallback(
    async (row: ConversationListRow) => {
      const supabase = createSupabaseBrowserClient();
      let contacts = row.contacts ?? null;
      if (row.contact_id && !contacts) {
        const { data } = await supabase
          .from("contacts")
          .select("full_name, phone, metadata")
          .eq("id", row.contact_id)
          .maybeSingle();
        contacts = data;
      }

      const mapped = mapConversationListRow({ ...row, contacts });
      if (!mapped) {
        return;
      }

      const isActive = mapped.id === activeConversationIdRef.current;
      if (isActive && mapped.unreadCount > 0) {
        mapped.unreadCount = 0;
        markConversationRead(mapped.id);
      }

      setConversations((current) => mergeInboxConversations(current, mapped, activeConversationIdRef.current));
    },
    [markConversationRead],
  );

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
      [conversationId]: (data ?? []).map(normalizeInboxMessage),
    }));
    setIsLoadingMessages(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversationId, selectedMessages.length]);

  useEffect(() => {
    if (!activeConversationId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`inbox-messages-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;

          const message = normalizeInboxMessage(
            row as {
              id: number;
              conversation_id: number;
              direction: "inbound" | "outbound";
              sender_type: "contact" | "agent" | "ai" | "system";
              content: string | null;
              media_url: string | null;
              metadata: unknown;
              created_at: string;
            },
          );

          setMessagesByConversation((current) => {
            const existing = current[activeConversationId] ?? [];
            const index = existing.findIndex((item) => item.id === message.id);
            const next =
              index >= 0
                ? existing.map((item) => (item.id === message.id ? message : item))
                : [...existing, message];
            return { ...current, [activeConversationId]: next };
          });

          const preview =
            message.content?.trim() || attachmentPreviewLabel(message.attachmentKind ?? "document", message.isVoice);
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === activeConversationId
                ? {
                    ...conversation,
                    lastMessageAt: message.createdAt,
                    updatedAt: message.createdAt,
                    lastMessagePreview: preview,
                    unreadCount: 0,
                  }
                : conversation,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`inbox-org-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          void applyConversationChange(row as ConversationListRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as
            | {
                conversation_id?: number;
                content?: string | null;
                media_url?: string | null;
                metadata?: unknown;
                created_at?: string;
              }
            | undefined;
          if (!row?.conversation_id || row.conversation_id === activeConversationIdRef.current) {
            return;
          }

          const preview = previewFromMessageRow({
            content: row.content ?? null,
            media_url: row.media_url ?? null,
            metadata: row.metadata,
          });
          const createdAt = row.created_at || new Date().toISOString();

          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === row.conversation_id
                ? {
                    ...conversation,
                    lastMessageAt: createdAt,
                    updatedAt: createdAt,
                    lastMessagePreview: preview,
                  }
                : conversation,
            ),
          );
        },
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadInboxConversations();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [applyConversationChange, loadInboxConversations, organizationId]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    setSelectedConversationId(initialConversationId);
    setIsMobileThreadOpen(Boolean(initialConversationId));
  }, [initialConversationId]);

  useEffect(() => {
    if (!initialConversationId) {
      return;
    }
    markConversationRead(initialConversationId);
  }, [initialConversationId, markConversationRead]);

  const handleSelectConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setIsMobileThreadOpen(true);
    markConversationRead(conversationId);
    if (!messagesByConversation[conversationId]) {
      void loadMessages(conversationId);
    }
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("conversation") !== String(conversationId)) {
      url.searchParams.set("conversation", String(conversationId));
      window.history.pushState({ inboxThread: conversationId }, "", url);
    }
  };

  const handleBackToInbox = () => {
    if (typeof window !== "undefined" && window.history.state?.inboxThread) {
      window.history.back();
      return;
    }
    setSelectedConversationId(null);
    setIsMobileThreadOpen(false);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("conversation")) {
      url.searchParams.delete("conversation");
      window.history.replaceState({ inboxThread: null }, "", url);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const conversationId = Number(new URLSearchParams(window.location.search).get("conversation"));
      if (Number.isInteger(conversationId) && conversationId > 0) {
        setSelectedConversationId(conversationId);
        setIsMobileThreadOpen(true);
        return;
      }
      setSelectedConversationId(null);
      setIsMobileThreadOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setHideMobileNav(isMobileThreadOpen);
    return () => setHideMobileNav(false);
  }, [isMobileThreadOpen, setHideMobileNav]);

  const handleSelectAttachmentKind = (kind: FileAttachmentKind) => {
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

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recordingStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);

        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (!blob.size) {
          setComposerError("No se capturó audio. Inténtalo de nuevo.");
          return;
        }

        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `nota-de-voz.${extension}`, {
          type: mimeType.split(";")[0],
        });
        setComposerAttachment({ kind: "audio", file, isVoice: true });
        setComposerError(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setComposerError(null);
    } catch {
      setComposerError("No se pudo acceder al micrófono.");
    }
  };

  const handleShareLocation = () => {
    if (!selectedConversation) return;
    if (!navigator.geolocation) {
      toast.error("Tu navegador no permite compartir ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          const result = await sendConversationMessageAction({
            conversationId: selectedConversation.id,
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              name: "Ubicación compartida",
            },
          });

          if (!result.data?.message) {
            toastActionError({
              code: result.code,
              error: result.error ?? "No se pudo enviar la ubicación.",
            });
            return;
          }

          const sentMessage = result.data.message;
          setMessagesByConversation((current) => ({
            ...current,
            [selectedConversation.id]: [...(current[selectedConversation.id] ?? []), sentMessage],
          }));
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === selectedConversation.id
                ? {
                    ...conversation,
                    status: "in_progress",
                    assignedUserId: currentUserId,
                    lastMessageAt: sentMessage.createdAt,
                    updatedAt: sentMessage.createdAt,
                    lastMessagePreview: "Ubicación",
                    unreadCount: 0,
                  }
                : conversation,
            ),
          );
          toast.success("Ubicación enviada");
        });
      },
      () => {
        toast.error("No se pudo obtener tu ubicación.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleSetConversationMode = (mode: InboxConversation["mode"]) => {
    if (!activeConversationId || selectedConversation?.mode === mode) return;

    startTransition(async () => {
      const result = await setConversationModeAction({
        conversationId: activeConversationId,
        mode,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                mode,
                status: mode === "human" ? "in_progress" : conversation.status,
                assignedUserId: mode === "human" ? currentUserId : null,
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );
      setComposerError(null);
      if (result.success) {
        toast.success(result.success);
      }
    });
  };

  const handleAssignConversation = (assignToMe: boolean) => {
    if (!activeConversationId) return;
    startTransition(async () => {
      const result = await assignConversationAction({ conversationId: activeConversationId, assignToMe });
      if (result.error) {
        toastActionError(result);
        return;
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                assignedUserId: assignToMe ? currentUserId : null,
                mode: assignToMe ? "human" : conversation.mode,
                status: assignToMe ? "in_progress" : conversation.status,
              }
            : conversation,
        ),
      );
      if (result.success) toast.success(result.success);
    });
  };

  const handleSuggestReply = () => {
    if (!activeConversationId) return;
    startTransition(async () => {
      const result = await suggestReplyAction({ conversationId: activeConversationId });
      if (result.error) {
        toastActionError(result);
        return;
      }
      if (result.reply) {
        setComposerText(result.reply);
        toast.success(result.success ?? "Sugerencia lista.");
      }
    });
  };

  const handleSendToFunnel = () => {
    if (!selectedConversation?.contactId) {
      toast.error("Esta conversación no tiene un contacto asociado.");
      return;
    }

    startTransition(async () => {
      const result = await createFunnelCardFromConversationAction({
        conversationId: selectedConversation.id,
      });

      if (result.error) {
        toastActionError(result);
        return;
      }

      toast.success("Contacto enviado al embudo");
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
        isVoice: attachmentPayload?.isVoice,
      });

      if (!result.data?.message) {
        setComposerError(result.error ?? "No se pudo enviar el mensaje.");
        return;
      }

      const sentMessage = result.data.message;
      const now = new Date().toISOString();
      const previewText =
        sentMessage.content?.trim() ||
        attachmentPreviewLabel(sentMessage.attachmentKind ?? "document", sentMessage.isVoice);

      setMessagesByConversation((current) => ({
        ...current,
        [selectedConversation.id]: [...(current[selectedConversation.id] ?? []), sentMessage],
      }));

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
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
      setComposerError(result.error ?? null);
    });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const showAudioQuickAction = !composerText.trim() && !composerAttachment && !isRecording;
  const hasComposerMeta = Boolean(composerAttachment || composerError || isRecording);

  return (
    <div className="grid h-[calc(100dvh-5.75rem)] max-h-[100dvh] gap-3 overflow-hidden md:h-[calc(100vh-2.5rem)] lg:grid-cols-[330px_1fr]">
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col border-primary/15 bg-card/70",
          isMobileThreadOpen && "max-lg:hidden",
        )}
      >
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
          {officeClosed ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-950 dark:text-amber-100">
              Oficina cerrada. La IA sigue atendiendo; los asesores están inactivos hasta el próximo horario.
            </p>
          ) : null}

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
                  const isAiActive = conversation.mode === "ai";
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition",
                        isSelected
                          ? "border-primary/30 bg-primary/10"
                          : "border-primary/10 bg-background/70 hover:bg-accent/70",
                      )}
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
                            <ChannelBadge channel={conversation.channel} />
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-7 px-2.5 text-[13px] [&>svg]:size-3.5!",
                                isAiActive &&
                                  "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_10px_rgba(34,211,238,0.4)] bg-cyan-400/15 text-cyan-700 dark:text-cyan-300",
                              )}
                            >
                              {isAiActive ? <GeminiIcon /> : null}
                              {resolveModeLabel(conversation.mode)}
                            </Badge>
                            {conversation.unreadCount > 0 ? (
                              <Badge className="h-7 min-w-7 px-2.5 text-[13px]">{conversation.unreadCount}</Badge>
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
        <Card
          className={cn(
            "flex h-full min-h-0 flex-col border-primary/15 bg-card/70",
            "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:h-dvh max-lg:rounded-none max-lg:border-0",
            !isMobileThreadOpen && "max-lg:hidden",
          )}
        >
          <CardHeader className="border-b border-primary/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="lg:hidden"
                  aria-label="Volver al inbox"
                  onClick={handleBackToInbox}
                >
                  <ArrowLeft />
                </Button>
                <Avatar>
                  <AvatarFallback>{resolveInitials(selectedConversation.contactName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedConversation.contactName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {resolveConversationSubtitle(selectedConversation)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1",
                    selectedConversation.mode === "ai"
                      ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_10px_rgba(34,211,238,0.4)]"
                      : "border-primary/15 bg-background/70",
                  )}
                >
                  <Label htmlFor="conversation-ai-mode" className="text-xs text-muted-foreground">
                    Agente IA
                  </Label>
                  <Switch
                    id="conversation-ai-mode"
                    size="sm"
                    checked={selectedConversation.mode === "ai"}
                    disabled={isPending}
                    aria-label={
                      selectedConversation.mode === "ai"
                        ? "Desactivar agente IA y tomar la conversación"
                        : "Activar agente IA"
                    }
                    onCheckedChange={(checked) => {
                      handleSetConversationMode(checked ? "ai" : "human");
                    }}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Opciones de conversación">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Conversación</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSendToFunnel} disabled={isPending}>
                      <KanbanSquare />
                      Enviar al embudo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAssignConversation(selectedConversation.assignedUserId !== currentUserId)}
                      disabled={isPending}
                    >
                      <UserPlus />
                      {selectedConversation.assignedUserId === currentUserId ? "Liberar chat" : "Asignarme este chat"}
                    </DropdownMenuItem>
                    {selectedConversation.contactId ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/contacts/${selectedConversation.contactId}`}>
                          <MessageCircle />
                          Ver ficha
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
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

                    if (message.senderType === "system") {
                      return (
                        <p key={message.id} className="px-4 py-1 text-center text-[11px] text-muted-foreground">
                          {message.content}
                        </p>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                      >
                        <article
                          className={`max-w-[min(22rem,85%)] overflow-hidden rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                            isOutbound
                              ? "border-primary/30 bg-primary/15 text-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {message.senderType === "ai" ? (
                            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-primary">
                              <Bot className="size-3" aria-hidden />
                              Agente IA
                            </p>
                          ) : null}
                          {message.content && message.attachmentKind !== "location" ? (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          ) : null}

                          <MessageMedia message={message} />

                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                            <span>{formatTime(message.createdAt)}</span>
                            {isOutbound && message.deliveryStatus === "failed" ? (
                              <AlertCircle
                                className="size-3 text-destructive"
                                aria-label="No se entregó al canal"
                              />
                            ) : null}
                            {isOutbound && message.deliveryStatus === "pending" ? (
                              <Clock className="size-3" aria-label="Enviando" />
                            ) : null}
                            {isOutbound && message.deliveryStatus !== "failed" && message.deliveryStatus !== "pending" ? (
                              <CheckCircle2 className="size-3" aria-label="Enviado" />
                            ) : null}
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

            <div
              className={`border-t border-primary/10 px-2 ${
                hasComposerMeta ? "py-2" : "py-1.5"
              }`}
            >
              {isRecording ? (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
                    Grabando nota de voz…
                  </span>
                  <Button type="button" variant="ghost" size="xs" onClick={() => void handleToggleRecording()}>
                    Detener
                  </Button>
                </div>
              ) : null}

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

              <div className="flex h-10 items-center gap-2">
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
                    <DropdownMenuItem onSelect={handleShareLocation} disabled={isPending}>
                      <MapPin />
                      Ubicación
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Sugerir respuesta con IA"
                  disabled={!selectedConversation || selectedConversation.mode === "ai" || isPending}
                  onClick={handleSuggestReply}
                >
                  <Sparkles />
                </Button>
                <Input
                  aria-label="Escribe una respuesta"
                  placeholder="Escribe un mensaje..."
                  className="h-10 flex-1"
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={!selectedConversation || isPending || isUploadingAttachment}
                />

                <Button
                  type="button"
                  size="icon"
                  aria-label={
                    isRecording
                      ? "Detener grabación"
                      : showAudioQuickAction
                        ? "Grabar nota de voz"
                        : "Enviar mensaje"
                  }
                  onClick={
                    isRecording || showAudioQuickAction
                      ? () => void handleToggleRecording()
                      : handleSendMessage
                  }
                  disabled={
                    !selectedConversation ||
                    isPending ||
                    isUploadingAttachment ||
                    (!isRecording && !showAudioQuickAction && !composerText.trim() && !composerAttachment)
                  }
                >
                  {isPending || isUploadingAttachment ? (
                    <Loader2 className="animate-spin" />
                  ) : isRecording ? (
                    <Square className="size-3.5 fill-current" />
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
        <div className="hidden h-full min-h-0 lg:block">
          <EmptyMetaState
            className="h-full"
            title="Selecciona una conversación para comenzar"
            description="Cuando selecciones un chat podrás ver el historial y responder como agente humano."
          />
        </div>
      )}
    </div>
  );
};
