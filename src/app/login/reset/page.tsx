import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Nueva contraseña | Innover Suite",
};

const ResetPasswordPage = async () => {
  const cookieStore = await cookies();
  const hasRecoveryCookie = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";

  if (!hasRecoveryCookie) {
    redirect("/login/forgot?reason=expired");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/forgot?reason=expired");
  }

  return (
    <AuthShell
      title="Nueva contraseña"
      description="Elige una contraseña nueva para tu cuenta. Después entrarás al panel."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
};

export default ResetPasswordPage;
