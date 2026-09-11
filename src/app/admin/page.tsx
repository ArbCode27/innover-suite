import Link from "next/link";
import { requirePlatformAdminSession } from "@/lib/billing/require-platform-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OrgRow = {
  id: number;
  name: string;
  plan: string | null;
  business_template: string | null;
  created_at: string;
};

type SubRow = {
  organization_id: number;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
};

type UsageRow = {
  organization_id: number;
  ai_responses: number;
  period_start: string;
};

const AdminOrganizationsPage = async () => {
  await requirePlatformAdminSession();
  const admin = getSupabaseAdminClient();

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, plan, business_template, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<OrgRow[]>();

  const orgIds = (orgs ?? []).map((org) => org.id);

  const [{ data: subs }, { data: usages }] = await Promise.all([
    orgIds.length
      ? admin
          .from("organization_subscriptions")
          .select(
            "organization_id, plan_id, status, current_period_start, current_period_end",
          )
          .in("organization_id", orgIds)
          .returns<SubRow[]>()
      : Promise.resolve({ data: [] as SubRow[] }),
    orgIds.length
      ? admin
          .from("organization_usage_periods")
          .select("organization_id, ai_responses, period_start")
          .in("organization_id", orgIds)
          .returns<UsageRow[]>()
      : Promise.resolve({ data: [] as UsageRow[] }),
  ]);

  const subByOrg = new Map((subs ?? []).map((row) => [row.organization_id, row]));
  const usageMatched = new Map<number, number>();
  for (const usage of usages ?? []) {
    const sub = subByOrg.get(usage.organization_id);
    if (sub && usage.period_start === sub.current_period_start) {
      usageMatched.set(usage.organization_id, usage.ai_responses);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan, estado de suscripción y consumo de respuestas IA.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Respuestas IA</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orgs ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay organizaciones o falta ejecutar el SQL de billing.
                </TableCell>
              </TableRow>
            ) : (
              (orgs ?? []).map((org) => {
                const sub = subByOrg.get(org.id);
                const used = usageMatched.get(org.id) ?? 0;
                return (
                  <TableRow key={org.id}>
                    <TableCell className="tabular-nums">{org.id}</TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub?.plan_id ?? org.plan ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{sub?.status ?? "sin suscripción"}</TableCell>
                    <TableCell className="tabular-nums">{used.toLocaleString("es-VE")}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Gestionar
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminOrganizationsPage;
