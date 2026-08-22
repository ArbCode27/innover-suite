import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { WEEKDAY_LABELS } from "@/lib/dashboard/constants";
import type { ChatFunnel, DashboardActivity, DashboardFinance } from "@/lib/dashboard/board";
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

export const FunnelDonut = ({ funnel }: { funnel: ChatFunnel }) => {
  const total = funnel.leads;
  const buyers = funnel.buyers;
  const inquirers = funnel.inquirers;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const buyerLength = total ? (buyers / total) * circumference : 0;
  const inquirerLength = total ? (inquirers / total) * circumference : 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="size-44" role="img" aria-label="Distribución de leads">
        <circle cx="80" cy="80" r={radius} className="fill-none stroke-muted" strokeWidth="18" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          className="fill-none stroke-emerald-500"
          strokeWidth="18"
          strokeDasharray={`${buyerLength} ${circumference}`}
          strokeDashoffset="0"
          transform="rotate(-90 80 80)"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          className="fill-none stroke-sky-400"
          strokeWidth="18"
          strokeDasharray={`${inquirerLength} ${circumference}`}
          strokeDashoffset={-buyerLength}
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="76" textAnchor="middle" className="fill-foreground text-2xl font-semibold">
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          leads
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          Compran · {buyers} ({percent(buyers, total)}%)
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-sky-400" />
          Solo preguntan · {inquirers} ({percent(inquirers, total)}%)
        </li>
      </ul>
    </div>
  );
};

export const ChannelBars = ({ funnel }: { funnel: ChatFunnel }) => {
  const max = Math.max(1, ...funnel.byChannel.map((row) => row.leads));

  return (
    <div className="space-y-4">
      {funnel.byChannel.length ? (
        funnel.byChannel.map((row) => {
          const buyerWidth = percent(row.buyers, max);
          const inquirerWidth = percent(row.inquirers, max);
          return (
            <div key={row.channel} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{channelLabel(row.channel)}</span>
                <span className="text-muted-foreground">
                  {row.leads} leads · {row.buyers} compran
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                <span className="h-full bg-emerald-500" style={{ width: `${buyerWidth}%` }} aria-hidden />
                <span className="h-full bg-sky-400" style={{ width: `${inquirerWidth}%` }} aria-hidden />
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay chats para graficar.</p>
      )}
    </div>
  );
};

export const RevenueSparkline = ({ daily }: { daily: DashboardFinance["daily"] }) => {
  const width = 560;
  const height = 140;
  const pad = 16;
  const max = Math.max(1, ...daily.map((row) => row.revenue));
  const points = daily.map((row, index) => {
    const x = pad + (index / Math.max(daily.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (row.revenue / max) * (height - pad * 2);
    return { x, y, ...row };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad},${height - pad} ${polyline} ${width - pad},${height - pad}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Ingresos de los últimos 14 días">
      <polygon points={area} className="fill-primary/15" />
      <polyline points={polyline} className="fill-none stroke-primary" strokeWidth="3" strokeLinejoin="round" />
      {points.map((point) => (
        <circle
          key={point.date}
          cx={point.x}
          cy={point.y}
          r="3"
          className="fill-primary"
          aria-label={`${point.date}, ${point.orders} ventas`}
        />
      ))}
    </svg>
  );
};

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
