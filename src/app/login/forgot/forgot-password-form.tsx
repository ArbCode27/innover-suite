"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/actions";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth/schema";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const ForgotPasswordForm = () => {
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleForgot = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);
    const result = await requestPasswordReset(values);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setSuccessMessage(
      result.success ?? "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.",
    );
  });

  return (
    <form className="space-y-5" onSubmit={handleForgot} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="forgot-email">Correo</FieldLabel>
          <Input
            id="forgot-email"
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
      </FieldGroup>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {successMessage}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Enviando...
          </>
        ) : (
          "Enviar enlace"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link className="text-primary underline-offset-4 hover:underline" href="/login">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
};
