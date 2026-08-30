"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

type AppErrorProps = {
  reset: () => void;
};

const AppError = ({ reset }: AppErrorProps) => {
  return (
    <AuthShell
      title="No se pudo cargar"
      description="Ocurrió un error inesperado. Puedes reintentar o volver al inicio."
    >
      <div className="flex flex-col gap-2">
        <Button className="w-full" size="lg" type="button" onClick={reset}>
          Reintentar
        </Button>
        <Button asChild className="w-full" variant="outline">
          <Link href="/home">Ir al inicio</Link>
        </Button>
      </div>
    </AuthShell>
  );
};

export default AppError;
