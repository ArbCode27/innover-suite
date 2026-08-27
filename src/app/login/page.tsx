import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | Innover Suite",
};

const LoginPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 p-8 pb-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Innover Suite
          </p>
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
          <CardDescription>
            Entra con tu correo de asesor para abrir el panel de conversaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-2">
          <LoginForm />
        </CardContent>
      </Card>
      <p className="mt-6 max-w-md text-center text-xs leading-5 text-muted-foreground">
        Al entrar aceptas las{" "}
        <a className="text-primary underline-offset-4 hover:underline" href="/terms">
          Condiciones del servicio
        </a>{" "}
        y la{" "}
        <a className="text-primary underline-offset-4 hover:underline" href="/privacy">
          Política de privacidad
        </a>
        .
      </p>
    </div>
  );
};

export default LoginPage;
