import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthUserWithTimeout } from "@/lib/supabase/auth-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationRole = "owner" | "admin" | "agent" | "viewer" | "kitchen" | "cashier";

export type OrganizationMembership = {
  organizationId: number;
  role: OrganizationRole;
  organizationName: string;
  logoUrl: string | null;
  themePalette: string | null;
};

type MembershipRow = {
  organization_id: number;
  role: OrganizationRole;
  organizations:
    | { name: string; logo_url?: string | null; theme_palette?: string | null }
    | { name: string; logo_url?: string | null; theme_palette?: string | null }[]
    | null;
};

const toOrganization = (value: MembershipRow["organizations"]) => {
  const row = Array.isArray(value) ? value[0] : value;
  return {
    name: row?.name ?? "Organización",
    logoUrl: typeof row?.logo_url === "string" && row.logo_url.trim() ? row.logo_url.trim() : null,
    themePalette:
      typeof row?.theme_palette === "string" && row.theme_palette.trim()
        ? row.theme_palette.trim()
        : null,
  };
};

export const loadMembershipForUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationMembership | null> => {
  const withBranding = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name, logo_url, theme_palette)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  let data = withBranding.data;
  if (withBranding.error) {
    const fallback = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<MembershipRow>();

    if (fallback.error) {
      throw fallback.error;
    }
    data = fallback.data;
  }

  if (!data?.organization_id) {
    return null;
  }

  const organization = toOrganization(data.organizations);

  return {
    organizationId: data.organization_id,
    role: data.role,
    organizationName: organization.name,
    logoUrl: organization.logoUrl,
    themePalette: organization.themePalette,
  };
};

export const loadCurrentMemberSession = cache(
  async (): Promise<{
    user: User | null;
    membership: OrganizationMembership | null;
    timedOut: boolean;
  }> => {
    const client = await createSupabaseServerClient();
    const { user, timedOut } = await getAuthUserWithTimeout(client);

    if (timedOut || !user) {
      return { user: null, membership: null, timedOut };
    }

    return {
      user,
      membership: await loadMembershipForUser(client, user.id),
      timedOut: false,
    };
  },
);

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

export const canManageListings = (membership: OrganizationMembership | null) =>
  hasOrganizationRole(membership, ["owner", "admin", "agent"]);

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
