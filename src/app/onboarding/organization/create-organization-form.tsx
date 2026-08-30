"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { createOrganizationAction } from "@/lib/organizations/actions";
import { redirectIfSessionExpired } from "@/lib/auth/session-client";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().trim().min(3, "El nombre de la organización debe tener al menos 3 caracteres"),
});

type Values = z.infer<typeof schema>;

export const CreateOrganizationForm = () => {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
    },
  });

  const handleCreate = handleSubmit(async (values) => {
    setFormMessage(null);
    const result = await createOrganizationAction(values);
    if (redirectIfSessionExpired(result)) return;
    if (result?.error) {
      setFormMessage(result.error);
    }
  });

  return (
    <form className="space-y-5" onSubmit={handleCreate} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="organization-name">Nombre de la empresa</FieldLabel>
          <Input
            id="organization-name"
            autoFocus
            placeholder="Acme Dental Studio"
            aria-invalid={Boolean(errors.name)}
            className="h-10"
            {...register("name")}
          />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>
      </FieldGroup>

      {formMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {formMessage}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Creando organización...
          </>
        ) : (
          "Crear organización"
        )}
      </Button>
    </form>
  );
};
