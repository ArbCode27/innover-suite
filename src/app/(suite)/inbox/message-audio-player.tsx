"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Mic, Music2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const WAVEFORM_BARS = 28;
const AUDIO_PLAY_EVENT = "innover-inbox-audio-play";

type MessageAudioPlayerProps = {
  src: string;
  isVoice: boolean;
  isOutbound?: boolean;
  className?: string;
};

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

const buildWaveform = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
    const wave =
      Math.abs(Math.sin(hash * 0.0013 + i * 0.47)) * 0.55 +
      Math.abs(Math.cos(hash * 0.0021 + i * 0.29)) * 0.45;
    return 0.22 + wave * 0.78;
  });
};

export const MessageAudioPlayer = ({
  src,
  isVoice,
  isOutbound = false,
  className,
}: MessageAudioPlayerProps) => {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);

  const bars = useMemo(() => buildWaveform(src), [src]);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const clock = isPlaying || currentTime > 0 ? formatClock(currentTime) : formatClock(duration);
  const label = isVoice ? "nota de voz" : "audio";
  const KindIcon = isVoice ? Mic : Music2;

  const syncDuration = useCallback(() => {
    const media = audioRef.current;
    if (!media) return;
    if (Number.isFinite(media.duration) && media.duration > 0) {
      setDuration(media.duration);
    }
  }, []);

  useEffect(() => {
    const handlePeerPlay = (event: Event) => {
      const playingId = (event as CustomEvent<string>).detail;
      if (playingId === playerId) return;
      audioRef.current?.pause();
    };

    window.addEventListener(AUDIO_PLAY_EVENT, handlePeerPlay);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handlePeerPlay);
      audioRef.current?.pause();
    };
  }, [playerId]);

  const handleToggle = () => {
    const media = audioRef.current;
    if (!media || hasError) return;

    if (media.paused) {
      window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: playerId }));
      void media.play().catch(() => setHasError(true));
      return;
    }

    media.pause();
  };

  const handleSeek = (clientX: number) => {
    const media = audioRef.current;
    const track = waveformRef.current;
    if (!media || !track || !Number.isFinite(media.duration) || media.duration <= 0) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    media.currentTime = ratio * media.duration;
    setCurrentTime(media.currentTime);
  };

  const handleWaveformClick = (event: MouseEvent<HTMLDivElement>) => {
    handleSeek(event.clientX);
  };

  const handleWaveformKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const media = audioRef.current;
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 2 : -2;
      media.currentTime = Math.min(media.duration, Math.max(0, media.currentTime + delta));
      setCurrentTime(media.currentTime);
    }
  };

  if (hasError) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-2.5 py-1.5 text-xs",
          className,
        )}
      >
        <KindIcon className="size-3.5 text-primary" aria-hidden />
        Descargar {label}
      </a>
    );
  }

  return (
    <div className={cn("flex min-w-[12.5rem] max-w-[16.5rem] items-center gap-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onError={() => setHasError(true)}
      />

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isPlaying ? `Pausar ${label}` : `Reproducir ${label}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {isPlaying ? (
          <Pause className="size-3.5 fill-current" aria-hidden />
        ) : (
          <Play className="size-3.5 translate-x-px fill-current" aria-hidden />
        )}
      </button>

      <div
        ref={waveformRef}
        role="slider"
        tabIndex={0}
        aria-label={`Posición de la ${label}`}
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(currentTime)}
        aria-valuetext={formatClock(currentTime)}
        className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-px rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={handleWaveformClick}
        onKeyDown={handleWaveformKeyDown}
      >
        {bars.map((height, index) => {
          const filled = index / bars.length <= progress;
          const sizeClass =
            height > 0.78 ? "h-7" : height > 0.58 ? "h-5" : height > 0.4 ? "h-3.5" : "h-2";

          return (
            <span
              key={index}
              className={cn(
                "min-w-0.5 flex-1 rounded-full",
                sizeClass,
                filled ? "bg-primary" : isOutbound ? "bg-primary/35" : "bg-primary/20",
              )}
            />
          );
        })}
      </div>

      <span className="shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {clock}
      </span>
    </div>
  );
};
