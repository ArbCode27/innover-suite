import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthShellProps = {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  showLegal?: boolean;
};

export const AuthShell = ({
  title,
  description,
  children,
  footer,
  showLegal = false,
}: AuthShellProps) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 p-8 pb-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Innover Suite
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent className="p-8 pt-2">{children}</CardContent> : null}
      </Card>
      {showLegal ? (
        <p className="mt-6 max-w-md text-center text-xs leading-5 text-muted-foreground">
          Al entrar aceptas las{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/terms">
            Condiciones del servicio
          </Link>{" "}
          y la{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/privacy">
            Política de privacidad
          </Link>
          .
        </p>
      ) : null}
      {footer}
    </div>
  );
};
