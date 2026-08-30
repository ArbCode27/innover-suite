import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña | Innover Suite",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

const ForgotPasswordPage = async ({ searchParams }: ForgotPasswordPageProps) => {
  const { reason } = await searchParams;

  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Te enviaremos un enlace para crear una nueva contraseña. Revisa también la carpeta de spam."
    >
      {reason === "expired" ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          El enlace expiró o ya se usó. Solicita uno nuevo.
        </p>
      ) : null}
      <ForgotPasswordForm />
    </AuthShell>
  );
};

export default ForgotPasswordPage;
