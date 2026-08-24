"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { saveOfficeHoursAction } from "@/lib/agent/actions";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_CLOSED_MESSAGE,
  DEFAULT_DAY_HOURS,
  OFFICE_TIMEZONES,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  countOpenDays,
  parseBusinessHours,
  type BusinessHours,
  type BusinessHoursDay,
} from "@/lib/agent/hours";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type OfficeHoursFormProps = {
  canManageOrganization: boolean;
  businessHours: BusinessHours;
  closedMessage: string;
};

const toDraftDays = (hours: BusinessHours) => {
  const next: Record<string, BusinessHoursDay> = {};
  for (const day of WEEKDAY_ORDER) {
    next[day] = hours.days[day] ?? { ...DEFAULT_DAY_HOURS };
  }
  return next;
};

const toOpenDays = (hours: BusinessHours) => {
  const next: Record<string, boolean> = {};
  for (const day of WEEKDAY_ORDER) {
    next[day] = Boolean(hours.days[day]);
  }
  return next;
};

const TimeField = ({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="relative min-w-0 flex-1">
    <Clock
      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
    <Input
      id={id}
      type="time"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="pl-8"
    />
  </div>
);

export const OfficeHoursForm = ({
  canManageOrganization,
  businessHours,
  closedMessage,
}: OfficeHoursFormProps) => {
  const initial = parseBusinessHours(businessHours);
  const [scheduleEnabled, setScheduleEnabled] = useState(initial.enabled !== false);
  const [afterHoursAiCoverage, setAfterHoursAiCoverage] = useState(initial.afterHoursAiCoverage !== false);
  const [timezone, setTimezone] = useState(initial.timezone ?? DEFAULT_BUSINESS_HOURS.timezone ?? "America/Santo_Domingo");
  const [message, setMessage] = useState(closedMessage);
  const [draftDays, setDraftDays] = useState(() => toDraftDays(initial));
  const [openDays, setOpenDays] = useState(() => toOpenDays(initial));
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timezoneOptions = useMemo(() => {
    const options = OFFICE_TIMEZONES.map((item) => ({ value: item.value, label: item.label }));
    if (!options.some((item) => item.value === timezone)) {
      options.unshift({ value: timezone, label: timezone });
    }
    return options;
  }, [timezone]);

  const previewHours = parseBusinessHours({
    timezone,
    enabled: scheduleEnabled,
    afterHoursAiCoverage,
    days: Object.fromEntries(
      WEEKDAY_ORDER.map((day) => [day, openDays[day] ? draftDays[day] : null]),
    ),
  });
  const openCount = countOpenDays(previewHours);

  const handleDayToggle = (day: string, open: boolean) => {
    setOpenDays((current) => ({ ...current, [day]: open }));
  };

  const handleTimeChange = (day: string, field: "open" | "close", value: string) => {
    setDraftDays((current) => ({
      ...current,
      [day]: {
        open: field === "open" ? value : current[day]?.open ?? DEFAULT_DAY_HOURS.open,
        close: field === "close" ? value : current[day]?.close ?? DEFAULT_DAY_HOURS.close,
      },
    }));
    if (value) {
      setOpenDays((current) => ({ ...current, [day]: true }));
    }
  };

  const handleRestoreDefaults = () => {
    const defaults = parseBusinessHours(DEFAULT_BUSINESS_HOURS);
    setScheduleEnabled(true);
    setAfterHoursAiCoverage(true);
    setTimezone(defaults.timezone ?? "America/Santo_Domingo");
    setMessage(DEFAULT_CLOSED_MESSAGE);
    setDraftDays(toDraftDays(defaults));
    setOpenDays(toOpenDays(defaults));
    setFormError(null);
  };

  const handleSubmit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveOfficeHoursAction({
        closedMessage: message,
        businessHours: {
          timezone,
          enabled: scheduleEnabled,
          afterHoursAiCoverage,
          days: Object.fromEntries(
            WEEKDAY_ORDER.map((day) => [day, openDays[day] ? draftDays[day] : null]),
          ),
        },
      });

      if (result.error) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Horario de oficina guardado");
    });
  };

  return (
    <Card id="horario-oficina" className="border-primary/15 bg-card/80">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle>Horario de oficina</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Define cuándo hay asesores. La IA atiende 24/7; fuera de este horario el equipo humano queda inactivo.
            </CardDescription>
          </div>
        </div>
        <Badge variant="outline">
          {scheduleEnabled ? `${openCount}/7 días abiertos` : "Siempre abierto"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/10 bg-background/70 p-4">
              <div>
                <p className="text-sm font-medium">Horario programado</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Activa la regla de apertura y cierre para los asesores.
                </p>
              </div>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
                disabled={!canManageOrganization}
                aria-label="Horario programado"
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/10 bg-background/70 p-4">
              <div>
                <p className="text-sm font-medium">IA cubre fuera de horario</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Si un chat quedó con un asesor, la IA lo retoma al cerrar la oficina.
                </p>
              </div>
              <Switch
                checked={afterHoursAiCoverage}
                onCheckedChange={setAfterHoursAiCoverage}
                disabled={!canManageOrganization}
                aria-label="IA cubre fuera de horario"
              />
            </div>

            <div className="space-y-2 rounded-2xl border border-primary/10 bg-background/70 p-4">
              <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Zona horaria
              </p>
              <AppSelect
                aria-label="Zona horaria de la oficina"
                value={timezone}
                options={timezoneOptions}
                onValueChange={setTimezone}
                disabled={!canManageOrganization}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closed-message">Mensaje si piden un asesor fuera de horario</Label>
              <textarea
                id="closed-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={!canManageOrganization}
                rows={4}
                className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6"
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            {canManageOrganization ? (
              <div className="space-y-2">
                <Button type="button" className="w-full" onClick={handleSubmit} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Guardar horarios
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleRestoreDefaults}
                  disabled={isPending}
                >
                  <RotateCcw />
                  Restaurar predeterminados
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Solo owner o admin pueden editar el horario.</p>
            )}
          </div>

          <div className={cn("space-y-3", !scheduleEnabled && "pointer-events-none opacity-55")}>
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Semana</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {WEEKDAY_ORDER.map((day) => {
                const isOpen = Boolean(openDays[day]);
                const hours = draftDays[day] ?? DEFAULT_DAY_HOURS;
                const label = WEEKDAY_LABELS[day];
                return (
                  <div
                    key={day}
                    className={cn(
                      "rounded-2xl border p-4 transition",
                      isOpen
                        ? "border-primary/20 bg-background/80"
                        : "border-border bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className={cn("text-xs", isOpen ? "text-emerald-600" : "text-muted-foreground")}>
                          {isOpen ? "Abierto" : "Cerrado"}
                        </p>
                      </div>
                      <Switch
                        checked={isOpen}
                        onCheckedChange={(checked) => handleDayToggle(day, checked)}
                        disabled={!canManageOrganization || !scheduleEnabled}
                        aria-label={`${label} ${isOpen ? "abierto" : "cerrado"}`}
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <TimeField
                        id={`${day}-open`}
                        label={`Apertura ${label}`}
                        value={hours.open}
                        disabled={!canManageOrganization || !scheduleEnabled || !isOpen}
                        onChange={(value) => handleTimeChange(day, "open", value)}
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <TimeField
                        id={`${day}-close`}
                        label={`Cierre ${label}`}
                        value={hours.close}
                        disabled={!canManageOrganization || !scheduleEnabled || !isOpen}
                        onChange={(value) => handleTimeChange(day, "close", value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
