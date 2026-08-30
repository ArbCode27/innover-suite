"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { changePassword } from "@/lib/auth/actions";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/auth/schema";
import { SESSION_EXPIRED_CODE } from "@/lib/auth/session-result";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export const SecuritySettingsForm = () => {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleChangePassword = handleSubmit(async (values) => {
    setFormError(null);
    const result = await changePassword(values);
    if (toastActionError(result)) {
      if (result && "code" in result && result.code === SESSION_EXPIRED_CODE) {
        return;
      }
      if (result && "error" in result && result.error) {
        setFormError(result.error);
      }
      return;
    }

    reset();
    toast.success("success" in result && result.success ? result.success : "Contraseña actualizada.");
  });

  return (
    <Card id="seguridad" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Cambia la contraseña de esta cuenta. No afecta a los demás miembros del equipo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleChangePassword} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.currentPassword) || undefined}>
              <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.currentPassword)}
                className="h-10"
                {...register("currentPassword")}
              />
              <FieldError>{errors.currentPassword?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="new-password">Contraseña nueva</FieldLabel>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                className="h-10"
                {...register("password")}
              />
              <FieldError>{errors.password?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
              <FieldLabel htmlFor="confirm-new-password">Confirmar contraseña</FieldLabel>
              <PasswordInput
                id="confirm-new-password"
                autoComplete="new-password"
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

          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Actualizar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
