"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { acceptInviteAction, signUpAndAcceptInviteAction, type InvitePreview } from "@/lib/organizations/invites";
import { inviteSignUpSchema, type InviteSignUpValues } from "@/lib/auth/schema";
import { EMAIL_NOT_CONFIRMED_CODE } from "@/lib/auth/session-result";
import { resendConfirmation } from "@/lib/auth/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type InviteAcceptFormProps = {
  invite: InvitePreview;
};

export const InviteAcceptForm = ({ invite }: InviteAcceptFormProps) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const form = useForm<InviteSignUpValues>({
    resolver: zodResolver(inviteSignUpSchema),
    defaultValues: {
      token: invite.token,
      email: invite.email,
      password: "",
      confirmPassword: "",
    },
  });

  const handleCreate = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setNeedsConfirmation(false);
    const result = await signUpAndAcceptInviteAction(values);
    if (result && "error" in result && result.error) {
      setErrorMessage(result.error);
      setNeedsConfirmation("code" in result && result.code === EMAIL_NOT_CONFIRMED_CODE);
      return;
    }
    if (result && "success" in result && result.success) {
      setSuccessMessage(result.success);
      setNeedsConfirmation("code" in result && result.code === EMAIL_NOT_CONFIRMED_CODE);
    }
  });

  const handleAccept = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsAccepting(true);
    const result = await acceptInviteAction(invite.token);
    setIsAccepting(false);
    if (result && "error" in result && result.error) setErrorMessage(result.error);
  };

  const handleResend = async () => {
    setIsResending(true);
    setErrorMessage(null);
    const result = await resendConfirmation({ email: invite.email });
    setIsResending(false);
    if (result.success) setSuccessMessage(result.success);
  };

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={handleCreate} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invite-email">Correo</FieldLabel>
            <Input id="invite-email" type="email" readOnly {...form.register("email")} />
          </Field>
          <Field data-invalid={Boolean(form.formState.errors.password) || undefined}>
            <FieldLabel htmlFor="invite-password">Contraseña nueva</FieldLabel>
            <PasswordInput
              id="invite-password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              className="h-10"
              {...form.register("password")}
            />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.formState.errors.confirmPassword) || undefined}>
            <FieldLabel htmlFor="invite-confirm">Confirmar contraseña</FieldLabel>
            <PasswordInput
              id="invite-confirm"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.confirmPassword)}
              className="h-10"
              {...form.register("confirmPassword")}
            />
            <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
          </Field>
        </FieldGroup>
        <input type="hidden" {...form.register("token")} />
        <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Crear cuenta y unirme
        </Button>
      </form>
      <Button
        className="w-full"
        disabled={isAccepting}
        type="button"
        variant="outline"
        onClick={() => {
          void handleAccept();
        }}
      >
        {isAccepting ? <Loader2 className="animate-spin" /> : null}
        Ya tengo cuenta, unirme
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {successMessage}
        </p>
      ) : null}
      {needsConfirmation ? (
        <Button
          className="w-full"
          disabled={isResending}
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
    </div>
  );
};
