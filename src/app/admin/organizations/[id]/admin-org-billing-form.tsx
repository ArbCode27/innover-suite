"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminAssignPlanAction,
  adminReactivateOrganizationAction,
  adminSuspendOrganizationAction,
} from "@/lib/billing/actions";
import { PLAN_CATALOG } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AdminOrgBillingFormProps = {
  organizationId: number;
  currentPlanId: string;
  currentStatus: string;
  adminNotes: string | null;
};

export const AdminOrgBillingForm = ({
  organizationId,
  currentPlanId,
  currentStatus,
  adminNotes,
}: AdminOrgBillingFormProps) => {
  const [planId, setPlanId] = useState(currentPlanId);
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [periodDays, setPeriodDays] = useState("30");
  const [isPending, startTransition] = useTransition();

  const handleAssign = () => {
    startTransition(async () => {
      const result = await adminAssignPlanAction({
        organizationId,
        planId,
        status: status as "trialing" | "active" | "past_due" | "suspended" | "canceled",
        periodDays: Number(periodDays) || 30,
        syncModules: true,
        adminNotes: notes.trim() || undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(("success" in result && result.success) || "Plan actualizado");
    });
  };

  const handleSuspend = () => {
    startTransition(async () => {
      const result = await adminSuspendOrganizationAction({
        organizationId,
        adminNotes: notes.trim() || undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(("success" in result && result.success) || "Suspendida");
      setStatus("suspended");
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await adminReactivateOrganizationAction({
        organizationId,
        days: Number(periodDays) || 30,
        setActive: true,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(("success" in result && result.success) || "Reactivada");
      setStatus("active");
    });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <select
            id="plan"
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
          >
            {PLAN_CATALOG.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} (${plan.priceUsd})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="trialing">trialing</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="suspended">suspended</option>
            <option value="canceled">canceled</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="days">Días del periodo (al guardar/reactivar)</Label>
          <select
            id="days"
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={periodDays}
            onChange={(event) => setPeriodDays(event.target.value)}
          >
            <option value="14">14</option>
            <option value="30">30</option>
            <option value="90">90</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas internas</Label>
        <textarea
          id="notes"
          className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Motivo de suspensión, acuerdo comercial, etc."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleAssign} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Guardar plan / periodo
        </Button>
        <Button type="button" variant="destructive" onClick={handleSuspend} disabled={isPending}>
          Suspender
        </Button>
        <Button type="button" variant="outline" onClick={handleReactivate} disabled={isPending}>
          Reactivar
        </Button>
      </div>
    </div>
  );
};
