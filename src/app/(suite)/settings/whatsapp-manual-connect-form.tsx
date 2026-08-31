"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { connectWhatsAppWithTokenAction } from "@/lib/integrations/whatsapp-actions";
import {
  connectWhatsAppWithTokenSchema,
  type ConnectWhatsAppWithTokenValues,
} from "@/lib/integrations/whatsapp-schema";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const WhatsAppManualConnectForm = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<ConnectWhatsAppWithTokenValues>({
    resolver: zodResolver(connectWhatsAppWithTokenSchema),
    defaultValues: {
      accessToken: "",
      phoneNumberId: "",
      wabaId: "",
    },
  });

  const handleToggleForm = () => {
    setIsOpen((current) => !current);
  };

  const handleConnect = form.handleSubmit(async (values) => {
    const result = await connectWhatsAppWithTokenAction(values);
    if (toastActionError(result)) {
      return;
    }
    if (result && "success" in result && result.success) {
      toast.success(result.success);
      form.reset();
      setIsOpen(false);
      router.refresh();
    }
  });

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        aria-expanded={isOpen}
        aria-controls="whatsapp-manual-connect"
        onClick={handleToggleForm}
      >
        <KeyRound />
        {isOpen ? "Ocultar vinculación por token" : "Vincular número existente"}
      </Button>
      {isOpen ? (
        <form
          id="whatsapp-manual-connect"
          className="space-y-3 rounded-xl border border-primary/15 bg-muted/30 p-3"
          onSubmit={handleConnect}
          noValidate
        >
          <p className="text-xs leading-5 text-muted-foreground">
            Si el número ya está Conectado en Meta Business Suite, pega un token de System User y los IDs de Graph. Así
            evitas el asistente que intenta crear otro número.
          </p>
          <FieldGroup className="gap-3">
            <Field data-invalid={Boolean(form.formState.errors.accessToken) || undefined}>
              <FieldLabel htmlFor="wa-access-token">Token de acceso</FieldLabel>
              <Input
                id="wa-access-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Token permanente del System User"
                aria-invalid={Boolean(form.formState.errors.accessToken)}
                {...form.register("accessToken")}
              />
              <FieldDescription>
                Business Settings → Usuarios del sistema → Generar token, con permisos de WhatsApp.
              </FieldDescription>
              <FieldError>{form.formState.errors.accessToken?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.phoneNumberId) || undefined}>
              <FieldLabel htmlFor="wa-phone-number-id">Phone Number ID</FieldLabel>
              <Input
                id="wa-phone-number-id"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ID numérico de Graph"
                aria-invalid={Boolean(form.formState.errors.phoneNumberId)}
                {...form.register("phoneNumberId")}
              />
              <FieldDescription>No uses el número con +58. Está en la ficha del número en Meta.</FieldDescription>
              <FieldError>{form.formState.errors.phoneNumberId?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.wabaId) || undefined}>
              <FieldLabel htmlFor="wa-waba-id">WABA ID (recomendado)</FieldLabel>
              <Input
                id="wa-waba-id"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Opcional si el token ya tiene el WABA asignado"
                aria-invalid={Boolean(form.formState.errors.wabaId)}
                {...form.register("wabaId")}
              />
              <FieldError>{form.formState.errors.wabaId?.message}</FieldError>
            </Field>
          </FieldGroup>
          <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {form.formState.isSubmitting ? "Validando…" : "Vincular con token"}
          </Button>
        </form>
      ) : null}
    </div>
  );
};
