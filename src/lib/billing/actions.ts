"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLAN_CATALOG } from "@/lib/billing/plans";
import { isPlatformAdminEmail } from "@/lib/billing/platform-admin";
import { provisionOrganizationSubscription } from "@/lib/billing/usage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const planIds = PLAN_CATALOG.map((plan) => plan.id) as [string, ...string[]];

const requirePlatformAdmin = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    return { error: "No autorizado.", user: null };
  }
  return { user, error: null };
};

const assignPlanSchema = z.object({
  organizationId: z.number().int().positive(),
  planId: z.enum(planIds),
  status: z.enum(["trialing", "active", "past_due", "suspended", "canceled"]).optional(),
  periodDays: z.number().int().min(1).max(366).optional(),
  syncModules: z.boolean().optional(),
  adminNotes: z.string().max(2000).optional(),
});

const suspendSchema = z.object({
  organizationId: z.number().int().positive(),
  adminNotes: z.string().max(2000).optional(),
});

const extendSchema = z.object({
  organizationId: z.number().int().positive(),
  days: z.number().int().min(1).max(366).default(30),
  setActive: z.boolean().optional(),
});

export const adminAssignPlanAction = async (raw: unknown) => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "No autorizado." };

  const parsed = assignPlanSchema.safeParse(raw);
  if (!parsed.success) return { error: "Datos de plan inválidos." };

  try {
    const result = await provisionOrganizationSubscription({
      organizationId: parsed.data.organizationId,
      planId: parsed.data.planId,
      status: parsed.data.status ?? "active",
      periodDays: parsed.data.periodDays ?? 30,
      syncModules: parsed.data.syncModules ?? true,
      adminNotes: parsed.data.adminNotes ?? null,
      resetUsage: true,
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
    revalidatePath("/billing");
    revalidatePath("/home");
    return { success: "Plan actualizado.", ...result };
  } catch (error) {
    console.error("[BILLING] adminAssignPlanAction", error);
    return { error: "No se pudo asignar el plan. ¿Corriste supabase/billing-phase1.sql?" };
  }
};

export const adminSuspendOrganizationAction = async (raw: unknown) => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "No autorizado." };

  const parsed = suspendSchema.safeParse(raw);
  if (!parsed.success) return { error: "Organización inválida." };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("organization_subscriptions")
    .update({
      status: "suspended",
      admin_notes: parsed.data.adminNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", parsed.data.organizationId);

  if (error) {
    return { error: "No se pudo suspender. ¿Existe la suscripción?" };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  revalidatePath("/billing");
  return { success: "Organización suspendida." };
};

export const adminReactivateOrganizationAction = async (raw: unknown) => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "No autorizado." };

  const parsed = extendSchema.safeParse(raw);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = getSupabaseAdminClient();
  const { data: sub } = await admin
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  if (!sub?.plan_id) {
    return { error: "La organización no tiene suscripción." };
  }

  try {
    await provisionOrganizationSubscription({
      organizationId: parsed.data.organizationId,
      planId: sub.plan_id,
      status: "active",
      periodDays: parsed.data.days,
      syncModules: false,
      resetUsage: true,
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
    revalidatePath("/billing");
    return { success: "Suscripción reactivada." };
  } catch (error) {
    console.error("[BILLING] adminReactivateOrganizationAction", error);
    return { error: "No se pudo reactivar la suscripción." };
  }
};
