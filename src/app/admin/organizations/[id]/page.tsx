import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminOrgBillingForm } from "@/app/admin/organizations/[id]/admin-org-billing-form";
import { loadOrgEntitlements } from "@/lib/billing/entitlements";
import { requirePlatformAdminSession } from "@/lib/billing/require-platform-admin";
import { MODULE_CATALOG } from "@/lib/modules/constants";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = {
  params: Promise<{ id: string }>;
};

const AdminOrganizationDetailPage = async ({ params }: PageProps) => {
  await requirePlatformAdminSession();
  const { id } = await params;
  const organizationId = Number(id);
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    notFound();
  }

  const admin = getSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, plan, business_template, created_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org) {
    notFound();
  }

  let entitlements;
  try {
    entitlements = await loadOrgEntitlements(organizationId, admin);
  } catch {
    entitlements = null;
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/admin">
          <ArrowLeft className="size-4" aria-hidden />
          Organizaciones
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ID {org.id}
          {org.business_template ? ` · template ${org.business_template}` : ""}
        </p>
      </div>

      {entitlements ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Plan</CardDescription>
              <CardTitle className="text-lg">{entitlements.plan.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{entitlements.subscriptionStatus}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Respuestas IA</CardDescription>
              <CardTitle className="text-lg tabular-nums">
                {entitlements.aiResponsesUsed} / {entitlements.aiResponsesLimit}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {entitlements.aiExhausted ? "Cupo agotado" : `${entitlements.aiRemaining} restantes`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Acceso suite</CardDescription>
              <CardTitle className="text-lg">{entitlements.suiteAccess}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Hasta {new Date(entitlements.periodEnd).toLocaleDateString("es-VE")}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar entitlements. Ejecuta <code>supabase/billing-phase1.sql</code>.
        </p>
      )}

      {entitlements ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Módulos efectivos</CardTitle>
            <CardDescription>Plan ∩ toggles de la organización</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {MODULE_CATALOG.map((module) => (
              <Badge
                key={module.key}
                variant={entitlements.effectiveModules[module.key] ? "default" : "outline"}
              >
                {module.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <AdminOrgBillingForm
        organizationId={organizationId}
        currentPlanId={entitlements?.plan.id ?? org.plan ?? "ventas_basic"}
        currentStatus={entitlements?.subscriptionStatus ?? "trialing"}
        adminNotes={entitlements?.adminNotes ?? null}
      />
    </div>
  );
};

export default AdminOrganizationDetailPage;
