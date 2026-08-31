"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/validation/zod-es";

type ActionResult = { success?: string; error?: string };

const requireAgent = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para gestionar contactos." } as const;
  }
  return { membership } as const;
};

export const upsertContactAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = z
    .object({
      id: z.number().int().positive().optional(),
      fullName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120, "El nombre no puede tener más de 120 caracteres."),
      phone: z.string().trim().max(40, "El teléfono no puede tener más de 40 caracteres.").optional(),
      email: z.string().trim().email("El correo no es válido. Revisa el @ y el dominio.").optional().or(z.literal("")),
    })
    .safeParse(rawValues);
  if (!parsed.success) return { error: zodErrorMessage(parsed.error, "Revisa el nombre, teléfono o correo del contacto.") };

  const access = await requireAgent();
  if ("error" in access) return access;

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: access.membership.organizationId,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("contacts")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("organization_id", access.membership.organizationId)
    : await supabase.from("contacts").insert(payload);

  if (error) return { error: error.message || "No se pudo guardar el contacto." };
  revalidatePath("/contacts");
  return { success: parsed.data.id ? "Contacto actualizado." : "Contacto creado." };
};

export const addContactNoteAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = z
    .object({
      contactId: z.number().int().positive(),
      body: z.string().trim().min(2).max(2000),
      visibleToAgent: z.boolean().optional(),
    })
    .safeParse(rawValues);
  if (!parsed.success) return { error: "La nota no es válida." };

  const access = await requireAgent();
  if ("error" in access) return access;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("contact_notes").insert({
    organization_id: access.membership.organizationId,
    contact_id: parsed.data.contactId,
    author_user_id: user?.id ?? null,
    body: parsed.data.body,
    visible_to_agent: parsed.data.visibleToAgent === true,
  });
  if (error) return { error: error.message || "No se pudo guardar la nota." };
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${parsed.data.contactId}`);
  revalidatePath("/inbox");
  return { success: "Nota guardada." };
};

export const addContactTagAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = z
    .object({
      contactId: z.number().int().positive(),
      name: z.string().trim().min(2).max(40),
    })
    .safeParse(rawValues);
  if (!parsed.success) return { error: "La etiqueta no es válida." };

  const access = await requireAgent();
  if ("error" in access) return access;

  const supabase = await createSupabaseServerClient();
  const { data: tag, error: tagError } = await supabase
    .from("contact_tags")
    .upsert(
      { organization_id: access.membership.organizationId, name: parsed.data.name },
      { onConflict: "organization_id,name" },
    )
    .select("id")
    .single();

  if (tagError || !tag?.id) return { error: tagError?.message || "No se pudo crear la etiqueta." };

  const { error } = await supabase.from("contact_tag_links").upsert({
    contact_id: parsed.data.contactId,
    tag_id: tag.id,
  });
  if (error) return { error: error.message || "No se pudo asignar la etiqueta." };
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${parsed.data.contactId}`);
  return { success: "Etiqueta asignada." };
};
