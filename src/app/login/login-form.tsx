"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { resendConfirmation, signIn } from "@/lib/auth/actions";
import { loginSchema, type LoginValues } from "@/lib/auth/schema";
import { EMAIL_NOT_CONFIRMED_CODE } from "@/lib/auth/session-result";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const LoginForm = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = handleSubmit(async (values) => {
    setAuthError(null);
    setInfoMessage(null);
    setNeedsConfirmation(false);
    const nextPath = new URLSearchParams(window.location.search).get("next");
    const result = await signIn(values, nextPath);

    if (result?.error) {
      setAuthError(result.error);
      setNeedsConfirmation(result.code === EMAIL_NOT_CONFIRMED_CODE);
    }
  });

  const handleResend = async () => {
    setIsResending(true);
    setAuthError(null);
    const result = await resendConfirmation({ email: getValues("email") });
    setIsResending(false);
    if (result.success) {
      setInfoMessage(result.success);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleLogin} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="ivan.p@example.net"
            aria-invalid={Boolean(errors.email)}
            className="h-10"
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.password) || undefined}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Link
              href="/login/forgot"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className="h-10"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </Field>
      </FieldGroup>

      {authError ? (
        <p className="text-sm text-destructive" role="alert">
          {authError}
        </p>
      ) : null}

      {infoMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {infoMessage}
        </p>
      ) : null}

      {needsConfirmation ? (
        <Button
          className="w-full"
          disabled={isResending || isSubmitting}
          type="button"
          variant="outline"
          onClick={() => {
            void handleResend();
          }}
        >
          {isResending ? <Loader2 className="animate-spin" /> : null}
          Reenviar correo de confirmación
        </Button>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
};
