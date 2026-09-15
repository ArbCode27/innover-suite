"use server";

import { revalidatePath } from "next/cache";
import {
  adminRejectRequestSchema,
  resubmitJoinRequestSchema,
  submitJoinRequestSchema,
  type JoinRequestRecord,
  type JoinRequestStatus,
} from "@/lib/billing/join-requests-types";
import { getPlanById } from "@/lib/billing/plans";
import { isPlatformAdminEmail } from "@/lib/billing/platform-admin";
import { provisionOrganizationSubscription } from "@/lib/billing/usage";
import { uploadPaymentReceipt } from "@/lib/media/storage";
import { applyBusinessProfile } from "@/lib/organizations/business-profile";
import { loadMembershipForUser } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10MB

export const loadUserJoinRequest = async (
  userId: string,
): Promise<JoinRequestRecord | null> => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_join_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<JoinRequestRecord>();

  if (error) {
    console.error("[JOIN_REQUESTS] loadUserJoinRequest error", error);
    return null;
  }
  return data;
};

export const submitJoinRequestAction = async (formData: FormData) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Debes iniciar sesión para enviar una solicitud." };
  }

  // Verificar si ya tiene organización activa
  const existingMembership = await loadMembershipForUser(supabase, user.id);
  if (existingMembership) {
    return { error: "Tu usuario ya pertenece a una organización activa." };
  }

  // Verificar si ya tiene una solicitud pendiente
  const latestRequest = await loadUserJoinRequest(user.id);
  if (latestRequest && latestRequest.status === "pending") {
    return { error: "Ya tienes una solicitud en revisión. Por favor espera la confirmación." };
  }

  // Parsear campos de texto
  const rawData = {
    organizationName: formData.get("organizationName"),
    businessTemplate: formData.get("businessTemplate"),
    planId: formData.get("planId"),
    paymentMethod: formData.get("paymentMethod"),
    paymentReference: formData.get("paymentReference"),
    customerNotes: formData.get("customerNotes") || undefined,
  };

  const parsed = submitJoinRequestSchema.safeParse(rawData);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Datos de la solicitud inválidos.";
    return { error: firstIssue };
  }

  // Validar plan y monto
  const plan = getPlanById(parsed.data.planId);
  if (!plan) {
    return { error: "El plan seleccionado no existe." };
  }

  // Validar comprobante (capture)
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Debes adjuntar el comprobante o captura del pago." };
  }

  if (file.size > MAX_RECEIPT_BYTES) {
    return { error: "El comprobante es demasiado pesado. El tamaño máximo es 10MB." };
  }

  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { error: "Formato no válido. Sube una imagen en formato JPG, PNG o WebP." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { publicUrl, path } = await uploadPaymentReceipt({
      userId: user.id,
      fileName: file.name,
      bytes,
      mimeType,
    });

    const admin = getSupabaseAdminClient();
    const { data: inserted, error: insertError } = await admin
      .from("organization_join_requests")
      .insert({
        user_id: user.id,
        user_email: user.email,
        organization_name: parsed.data.organizationName,
        business_template: parsed.data.businessTemplate,
        plan_id: parsed.data.planId,
        payment_method: parsed.data.paymentMethod,
        payment_reference: parsed.data.paymentReference,
        receipt_url: publicUrl,
        receipt_storage_path: path,
        amount_usd: plan.priceUsd,
        customer_notes: parsed.data.customerNotes ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[JOIN_REQUESTS] insert error", insertError);
      return { error: "No se pudo registrar la solicitud. ¿Corriste el SQL de solicitudes?" };
    }

    revalidatePath("/solicitud");
    revalidatePath("/admin/solicitudes");
    return { success: "Solicitud enviada exitosamente.", requestId: inserted.id };
  } catch (err) {
    console.error("[JOIN_REQUESTS] upload/insert failed", err);
    return { error: "Ocurrió un error al procesar el comprobante. Intenta nuevamente." };
  }
};

export const resubmitJoinRequestAction = async (formData: FormData) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const rawData = {
    requestId: Number(formData.get("requestId")),
    paymentReference: formData.get("paymentReference"),
    customerNotes: formData.get("customerNotes") || undefined,
  };

  const parsed = resubmitJoinRequestSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Datos del reenvío inválidos." };
  }

  const admin = getSupabaseAdminClient();
  const { data: request } = await admin
    .from("organization_join_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .eq("user_id", user.id)
    .maybeSingle<JoinRequestRecord>();

  if (!request) {
    return { error: "Solicitud no encontrada." };
  }

  if (request.status !== "rejected") {
    return { error: "Esta solicitud no está en estado rechazado." };
  }

  let receiptUrl = request.receipt_url;
  let receiptPath = request.receipt_storage_path;

  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT_BYTES) {
      return { error: "El comprobante es demasiado pesado (máximo 10MB)." };
    }
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { error: "Formato no válido. Sube una imagen en formato JPG, PNG o WebP." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadPaymentReceipt({
      userId: user.id,
      fileName: file.name,
      bytes,
      mimeType,
    });
    receiptUrl = uploaded.publicUrl;
    receiptPath = uploaded.path;
  }

  const { error: updateError } = await admin
    .from("organization_join_requests")
    .update({
      payment_reference: parsed.data.paymentReference,
      customer_notes: parsed.data.customerNotes ?? request.customer_notes,
      receipt_url: receiptUrl,
      receipt_storage_path: receiptPath,
      status: "pending",
      admin_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (updateError) {
    return { error: "No se pudo actualizar la solicitud." };
  }

  revalidatePath("/solicitud");
  revalidatePath("/admin/solicitudes");
  return { success: "Comprobante reenviado a revisión." };
};

// ---------------------------------------------------------------------------
// Operaciones de Administrador de Plataforma
// ---------------------------------------------------------------------------

const requirePlatformAdmin = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    return { error: "No autorizado como administrador de plataforma.", user: null };
  }
  return { user, error: null };
};

export const loadAdminJoinRequests = async (statusFilter?: JoinRequestStatus | "all") => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) {
    throw new Error("No autorizado");
  }

  const admin = getSupabaseAdminClient();
  let query = admin
    .from("organization_join_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.returns<JoinRequestRecord[]>();
  if (error) {
    console.error("[JOIN_REQUESTS] loadAdminJoinRequests error", error);
    return [];
  }
  return data ?? [];
};

export const loadPendingJoinRequestsCount = async (): Promise<number> => {
  try {
    const admin = getSupabaseAdminClient();
    const { count, error } = await admin
      .from("organization_join_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
};

export const adminApproveJoinRequestAction = async (requestId: number) => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const admin = getSupabaseAdminClient();
  const { data: request, error: reqError } = await admin
    .from("organization_join_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle<JoinRequestRecord>();

  if (reqError || !request) {
    return { error: "Solicitud no encontrada." };
  }

  if (request.status === "approved") {
    return { error: "Esta solicitud ya fue aprobada previamente." };
  }

  const plan = getPlanById(request.plan_id);
  if (!plan) {
    return { error: `Plan no reconocido: ${request.plan_id}` };
  }

  // Mapear plantilla de negocio
  const businessTemplate =
    request.business_template === "ventas"
      ? "retail"
      : request.business_template;

  try {
    // 1. Crear Organización
    const { data: newOrg, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: request.organization_name,
        owner_user_id: request.user_id,
        plan: request.plan_id,
        business_template: businessTemplate,
        tax_rate: 0.16,
        currencies: ["USD", "VES"],
        default_currency: "USD",
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orgError || !newOrg) {
      console.error("[JOIN_REQUESTS] org insert failed", orgError);
      return { error: `Error creando la organización: ${orgError?.message}` };
    }

    const organizationId = Number(newOrg.id);

    // 2. Asociar Miembro Owner
    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: request.user_id,
      role: "owner",
      status: "active",
    });

    if (memberError) {
      console.error("[JOIN_REQUESTS] member insert failed", memberError);
      return { error: `Error asignando usuario a la organización: ${memberError.message}` };
    }

    // 3. Aplicar perfil de negocio y plantilla inicial
    try {
      await applyBusinessProfile({
        supabase: admin,
        organizationId,
        userId: request.user_id,
        templateId: businessTemplate as "restaurant" | "retail" | "services" | "realestate",
        currency: "USD",
        taxRate: 0.16,
      });
    } catch (profileError) {
      console.error("[JOIN_REQUESTS] applyBusinessProfile warning", profileError);
    }

    // 4. Aprovisionar suscripción activa (30 días de periodo)
    await provisionOrganizationSubscription({
      organizationId,
      planId: request.plan_id,
      status: "active",
      periodDays: 30,
      syncModules: true,
      adminNotes: `Aprobado por ${auth.user.email} (Pago: ${request.payment_method}, Ref: ${request.payment_reference})`,
    });

    // 5. Actualizar la solicitud a aprobada
    await admin
      .from("organization_join_requests")
      .update({
        status: "approved",
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        created_organization_id: organizationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    revalidatePath("/admin");
    revalidatePath("/admin/solicitudes");
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath("/solicitud");
    revalidatePath("/home");

    return { success: "Solicitud aprobada y organización activada exitosamente." };
  } catch (err) {
    console.error("[JOIN_REQUESTS] approve error", err);
    return { error: "Ocurrió un error al activar la organización." };
  }
};

export const adminRejectJoinRequestAction = async (raw: unknown) => {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const parsed = adminRejectRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = getSupabaseAdminClient();
  const { error: updateError } = await admin
    .from("organization_join_requests")
    .update({
      status: "rejected",
      admin_notes: parsed.data.reason,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId);

  if (updateError) {
    console.error("[JOIN_REQUESTS] reject error", updateError);
    return { error: "No se pudo rechazar la solicitud." };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath("/solicitud");
  return { success: "Solicitud rechazada." };
};
