import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Crear cuenta | Innover Suite",
  description: "Crea tu cuenta para comenzar el proceso de activación de tu organización en Innover Suite.",
};

const RegisterPage = () => {
  return (
    <AuthShell
      title="Crear cuenta"
      description="Ingresa tus datos para registrarte y solicitar la activación de tu organización."
      showLegal
    >
      <RegisterForm />
    </AuthShell>
  );
};

export default RegisterPage;
