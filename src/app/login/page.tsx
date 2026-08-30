import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | Innover Suite",
};

const LoginPage = () => {
  return (
    <AuthShell
      title="Iniciar sesión"
      description="Entra con tu correo de asesor para abrir el panel de conversaciones."
      showLegal
    >
      <LoginForm />
    </AuthShell>
  );
};

export default LoginPage;
