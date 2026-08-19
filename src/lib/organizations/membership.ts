import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationRole = "owner" | "admin" | "agent" | "viewer";

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

export const getCurrentMembership = async (): Promise<OrganizationMembership | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", user.id)
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

export const hasOrganizationRole = (
  membership: OrganizationMembership | null,
  roles: OrganizationRole[],
) => {
  if (!membership) {
    return false;
  }

  return roles.includes(membership.role);
};
