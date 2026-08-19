"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, Waypoints } from "lucide-react";
import {
  connectInstagramAccountAction,
  inviteAdvisorAction,
} from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const inviteSchema = z.object({
  email: z.email("Ingresa un correo válido"),
});

const instagramSchema = z.object({
  instagramAccountId: z.string().trim().min(2, "Ingresa un identificador válido"),
  displayName: z.string().trim().min(2, "Ingresa un nombre visible"),
});

type InviteValues = z.infer<typeof inviteSchema>;
type InstagramValues = z.infer<typeof instagramSchema>;

export const TeamAndIntegrationsForm = () => {
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });
  const instagramForm = useForm<InstagramValues>({
    resolver: zodResolver(instagramSchema),
    defaultValues: {
      instagramAccountId: "",
      displayName: "",
    },
  });

  const handleInvite = inviteForm.handleSubmit(async (values) => {
    setInviteMessage(null);
    const result = await inviteAdvisorAction({ ...values, role: "agent" });
    setInviteMessage(result?.success || result?.error || null);
  });

  const handleConnectInstagram = instagramForm.handleSubmit(async (values) => {
    setConnectMessage(null);
    const result = await connectInstagramAccountAction(values);
    setConnectMessage(result?.success || result?.error || null);
  });

  const inviteError = inviteMessage && !inviteMessage.toLowerCase().includes("registrada");
  const connectError =
    connectMessage && !connectMessage.toLowerCase().includes("correctamente");

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={handleInvite} noValidate>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="size-4 text-primary" />
          Invitar asesor
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(inviteForm.formState.errors.email) || undefined}>
            <FieldLabel htmlFor="advisor-email">Correo del asesor</FieldLabel>
            <Input
              id="advisor-email"
              type="email"
              placeholder="asesor@empresa.com"
              aria-invalid={Boolean(inviteForm.formState.errors.email)}
              {...inviteForm.register("email")}
            />
            <FieldError>{inviteForm.formState.errors.email?.message}</FieldError>
          </Field>
        </FieldGroup>
        {inviteMessage ? (
          <p className={`text-sm ${inviteError ? "text-destructive" : "text-emerald-600"}`}>
            {inviteMessage}
          </p>
        ) : null}
        <Button disabled={inviteForm.formState.isSubmitting} type="submit" variant="outline">
          {inviteForm.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Guardando...
            </>
          ) : (
            "Invitar asesor"
          )}
        </Button>
      </form>

      <form className="space-y-4" onSubmit={handleConnectInstagram} noValidate>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Waypoints className="size-4 text-primary" />
          Vincular cuenta de Instagram
        </div>
        <FieldGroup>
          <Field
            data-invalid={Boolean(instagramForm.formState.errors.displayName) || undefined}
          >
            <FieldLabel htmlFor="instagram-display">Nombre visible</FieldLabel>
            <Input
              id="instagram-display"
              placeholder="Clínica Acme"
              aria-invalid={Boolean(instagramForm.formState.errors.displayName)}
              {...instagramForm.register("displayName")}
            />
            <FieldError>{instagramForm.formState.errors.displayName?.message}</FieldError>
          </Field>
          <Field
            data-invalid={Boolean(instagramForm.formState.errors.instagramAccountId) || undefined}
          >
            <FieldLabel htmlFor="instagram-account-id">Instagram Account ID</FieldLabel>
            <Input
              id="instagram-account-id"
              placeholder="1784xxxxxxxxxxxx"
              aria-invalid={Boolean(instagramForm.formState.errors.instagramAccountId)}
              {...instagramForm.register("instagramAccountId")}
            />
            <FieldError>
              {instagramForm.formState.errors.instagramAccountId?.message}
            </FieldError>
          </Field>
        </FieldGroup>
        {connectMessage ? (
          <p className={`text-sm ${connectError ? "text-destructive" : "text-emerald-600"}`}>
            {connectMessage}
          </p>
        ) : null}
        <Button disabled={instagramForm.formState.isSubmitting} type="submit">
          {instagramForm.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Vinculando...
            </>
          ) : (
            "Vincular Instagram"
          )}
        </Button>
      </form>
    </div>
  );
};
