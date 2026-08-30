import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  return (
    <AuthShell
      title="Página no encontrada"
      description="Esta ruta no existe o ya no está disponible."
    >
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full" size="lg">
          <Link href="/home">Ir al inicio</Link>
        </Button>
        <Button asChild className="w-full" variant="outline">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    </AuthShell>
  );
};

export default NotFoundPage;
