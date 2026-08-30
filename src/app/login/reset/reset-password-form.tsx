"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { updatePassword } from "@/lib/auth/actions";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/auth/schema";
import { RECOVERY_EXPIRED_CODE } from "@/lib/auth/session-result";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export const ResetPasswordForm = () => {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleReset = handleSubmit(async (values) => {
    setFormError(null);
    const result = await updatePassword(values);

    if (result?.code === RECOVERY_EXPIRED_CODE) {
      router.replace("/login/forgot?reason=expired");
      return;
    }

    if (result?.error) {
      setFormError(result.error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={handleReset} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="reset-password">Contraseña nueva</FieldLabel>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className="h-10"
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
          <FieldLabel htmlFor="reset-confirm">Confirmar contraseña</FieldLabel>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            className="h-10"
            {...register("confirmPassword")}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>
      </FieldGroup>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar contraseña"
        )}
      </Button>
    </form>
  );
};
