import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationRole = "owner" | "admin" | "agent" | "viewer" | "kitchen" | "cashier";

export type OrganizationMembership = {
  organizationId: number;
  role: OrganizationRole;
  organizationName: string;
};

type MembershipRow = {
  organization_id: number;
  role: OrganizationRole;
  organizations: { name: string } | { name: string }[] | null;
};

const toOrganizationName = (value: MembershipRow["organizations"]) => {
  if (Array.isArray(value)) {
    return value[0]?.name ?? "Organización";
  }

  return value?.name ?? "Organización";
};

export const loadMembershipForUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationMembership | null> => {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (error) {
    throw error;
  }

  if (!data?.organization_id) {
    return null;
  }

  return {
    organizationId: data.organization_id,
    role: data.role,
    organizationName: toOrganizationName(data.organizations),
  };
};

export const loadCurrentMemberSession = async (
  supabase?: SupabaseClient,
): Promise<{ user: User | null; membership: OrganizationMembership | null }> => {
  const client = supabase ?? (await createSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { user: null, membership: null };
  }

  return {
    user,
    membership: await loadMembershipForUser(client, user.id),
  };
};

export const getCurrentMembership = async (): Promise<OrganizationMembership | null> => {
  const { membership } = await loadCurrentMemberSession();
  return membership;
};

export const hasOrganizationRole = (
  membership: OrganizationMembership | null,
  roles: OrganizationRole[],
) => Boolean(membership && roles.includes(membership.role));

export const canUseInbox = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent", "viewer"]);

export const canReplyInbox = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent"]);

export const canManageCatalog = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent", "kitchen"]);

export const canManageOrders = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent", "kitchen", "cashier"]);

export const canMarkPayment = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent", "cashier"]);

export const canViewReports = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin"]);

export const canManageOrganization = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin"]);

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Asesor",
  viewer: "Viewer",
  kitchen: "Cocina",
  cashier: "Caja",
};
