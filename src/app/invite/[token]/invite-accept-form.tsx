"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { acceptInviteAction, signUpAndAcceptInviteAction, type InvitePreview } from "@/lib/organizations/invites";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.email("Ingresa un correo válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

type InviteAcceptFormProps = {
  invite: InvitePreview;
};

export const InviteAcceptForm = ({ invite }: InviteAcceptFormProps) => {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: invite.email, password: "" },
  });

  const handleCreate = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await signUpAndAcceptInviteAction({
      token: invite.token,
      email: values.email,
      password: values.password,
    });
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    if (result && "success" in result && result.success) {
      setMessage(result.success);
    }
  });

  const handleAccept = async () => {
    setMessage(null);
    const result = await acceptInviteAction(invite.token);
    if (result && "error" in result && result.error) setMessage(result.error);
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
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </Field>
        </FieldGroup>
        <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Crear cuenta y unirme
        </Button>
      </form>
      <Button className="w-full" type="button" variant="outline" onClick={handleAccept}>
        Ya tengo cuenta, unirme
      </Button>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
};
