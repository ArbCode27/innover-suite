import { InviteAcceptForm } from "./invite-accept-form";
import { loadInvitePreview } from "@/lib/organizations/invites";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await loadInvitePreview(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 p-8 pb-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Innover Suite</p>
          <CardTitle className="text-2xl">Invitación al equipo</CardTitle>
          <CardDescription>
            {invite
              ? `Te invitaron a ${invite.organizationName} como ${invite.role}.`
              : "Esta invitación no es válida o ya expiró."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-2">
          {invite ? <InviteAcceptForm invite={invite} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
