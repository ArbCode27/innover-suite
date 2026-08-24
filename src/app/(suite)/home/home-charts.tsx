import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { WEEKDAY_LABELS } from "@/lib/dashboard/constants";
import type { DashboardActivity } from "@/lib/dashboard/board";
import type { MetaChannel } from "@/types/domain";

export const percent = (value: number, total: number) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

export const formatDuration = (ms: number | null) => {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const minutes = ms / 60000;
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (minutes < 60) return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
};

export const formatGrowth = (value: number | null) => {
  if (value === null) return "Sin base anterior";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% vs periodo anterior`;
};

export const channelLabel = (channel: string) =>
  channel === "otro" ? "Otro" : (CHANNEL_LABELS[channel as MetaChannel] ?? channel);

const heatClass = (value: number, max: number) => {
  if (!value || !max) return "bg-muted/40";
  const ratio = value / max;
  if (ratio < 0.25) return "bg-sky-400/30";
  if (ratio < 0.5) return "bg-sky-400/55";
  if (ratio < 0.75) return "bg-sky-500/80";
  return "bg-sky-600";
};

export const ActivityHeatmap = ({ activity }: { activity: DashboardActivity }) => {
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-1" role="img" aria-label="Mapa de calor de mensajes por hora y día">
        <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
          <span />
          {hours.map((hour) => (
            <span key={hour} className="text-center">
              {hour}
            </span>
          ))}
        </div>
        {WEEKDAY_LABELS.map((label, weekday) => (
          <div key={label} className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-1">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            {hours.map((hour) => {
              const value = activity.heatmap[weekday]?.[hour] ?? 0;
              return (
                <span
                  key={`${label}-${hour}`}
                  title={`${label} ${hour}:00 · ${value} mensajes`}
                  className={`h-4 rounded-sm ${heatClass(value, activity.maxHeat)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
