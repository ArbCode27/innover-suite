"use client";

import { FileText, ImageIcon, Loader2, MapPin, Mic, Video } from "lucide-react";
import { mapsUrlFromLocation, attachmentPreviewLabel } from "@/lib/media/parse";
import type { InboxMessage } from "./types";

type MessageMediaProps = {
  message: InboxMessage;
};

const iconForKind = (kind: InboxMessage["attachmentKind"]) => {
  if (kind === "image" || kind === "sticker") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "audio") return Mic;
  if (kind === "location") return MapPin;
  return FileText;
};

export const MessageMedia = ({ message }: MessageMediaProps) => {
  const kind = message.attachmentKind;
  const Icon = iconForKind(kind);

  if (kind === "location" && message.location) {
    const href = mapsUrlFromLocation(message.location);
    const label = message.location.name || message.location.address || "Ver en el mapa";

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block overflow-hidden rounded-xl border border-primary/20 bg-primary/8"
      >
        <div className="flex items-start gap-2 px-3 py-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {message.location.address && message.location.name ? (
              <p className="truncate text-xs text-muted-foreground">{message.location.address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {message.location.lat.toFixed(5)}, {message.location.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      </a>
    );
  }

  if (message.attachmentStatus === "pending") {
    return (
      <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Procesando {attachmentPreviewLabel(kind ?? "document", message.isVoice).toLowerCase()}…
      </p>
    );
  }

  if (message.attachmentStatus === "failed") {
    return (
      <p className="mt-2 text-xs text-destructive">No se pudo cargar el archivo.</p>
    );
  }

  if ((kind === "image" || kind === "sticker") && message.mediaUrl) {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 block">
        <img
          src={message.mediaUrl}
          alt={message.attachmentName || "Imagen"}
          className="max-h-64 w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  if (kind === "video" && message.mediaUrl) {
    return (
      <video controls preload="metadata" className="mt-2 max-h-64 w-full rounded-xl bg-black" src={message.mediaUrl}>
        Tu navegador no puede reproducir este video.
      </video>
    );
  }

  if (kind === "audio" && message.mediaUrl) {
    return (
      <div className="mt-2 min-w-52">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          {message.isVoice ? "Nota de voz" : "Audio"}
        </p>
        <audio controls preload="metadata" className="w-full" src={message.mediaUrl}>
          Tu navegador no puede reproducir este audio.
        </audio>
      </div>
    );
  }

  if (message.mediaUrl) {
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-2 py-1 text-xs"
      >
        <Icon className="size-3.5" aria-hidden />
        {message.attachmentName || attachmentPreviewLabel(kind ?? "document", message.isVoice)}
      </a>
    );
  }

  return null;
};
