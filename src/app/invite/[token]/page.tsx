import Link from "next/link";
import { InviteAcceptForm } from "./invite-accept-form";
import { loadInvitePreview } from "@/lib/organizations/invites";
import { ROLE_LABELS, type OrganizationRole } from "@/lib/organizations/membership";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

const roleLabel = (role: string) =>
  role in ROLE_LABELS ? ROLE_LABELS[role as OrganizationRole] : role;

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await loadInvitePreview(token);

  if (!invite) {
    return (
      <AuthShell
        title="Invitación no disponible"
        description="Esta invitación no es válida o ya expiró. Pide una nueva a un admin de tu equipo."
      >
        <Button asChild className="w-full" size="lg">
          <Link href="/login">Ir al inicio de sesión</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Invitación al equipo"
      description={`Te invitaron a ${invite.organizationName} como ${roleLabel(invite.role)}.`}
    >
      <InviteAcceptForm invite={invite} />
    </AuthShell>
  );
}
