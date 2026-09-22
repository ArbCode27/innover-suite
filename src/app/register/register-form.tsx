"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { signUp } from "@/lib/auth/actions";
import { signUpSchema, type SignUpValues } from "@/lib/auth/schema";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const RegisterForm = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loginHref, setLoginHref] = useState("/login?next=/solicitud");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      setLoginHref(`/login?next=${encodeURIComponent(next)}`);
    }
  }, []);

  const handleSignUp = handleSubmit(async (values) => {
    setAuthError(null);
    setSuccessMessage(null);
    const nextPath = new URLSearchParams(window.location.search).get("next");
    const result = await signUp(values, nextPath);

    if (result?.error) {
      setAuthError(result.error);
      return;
    }

    if (result?.success) {
      setSuccessMessage(result.success);
    }
  });

  if (successMessage) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <Mail className="size-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Revisa tu correo electrónico
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {successMessage}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          Te enviamos un enlace de activación. Haz clic en el enlace del correo para confirmar tu cuenta y continuar directamente con tu solicitud.
        </div>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={loginHref}>Ir al inicio de sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSignUp} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.fullName) || undefined}>
          <FieldLabel htmlFor="fullName">Nombre completo</FieldLabel>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            autoFocus
            placeholder="Ej. Carlos Mendoza"
            aria-invalid={Boolean(errors.fullName)}
            className="h-10"
            {...register("fullName")}
          />
          <FieldError>{errors.fullName?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="carlos@tuempresa.com"
            aria-invalid={Boolean(errors.email)}
            className="h-10"
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            aria-invalid={Boolean(errors.password)}
            className="h-10"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirmar contraseña</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            aria-invalid={Boolean(errors.confirmPassword)}
            className="h-10"
            {...register("confirmPassword")}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>
      </FieldGroup>

      {authError ? (
        <p className="text-sm text-destructive" role="alert">
          {authError}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        ¿Ya tienes una cuenta?{" "}
        <Link
          href={loginHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </div>
    </form>
  );
};
