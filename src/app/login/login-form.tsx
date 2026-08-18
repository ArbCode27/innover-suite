"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth/actions";
import { loginSchema, type LoginValues } from "@/lib/auth/schema";
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
  const {
    register,
    handleSubmit,
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
    const result = await signIn(values);

    if (result?.error) {
      setAuthError(result.error);
    }
  });

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
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            type="password"
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
