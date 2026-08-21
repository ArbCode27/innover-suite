import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

type InstagramConnectionRow = {
  instagram_user_id: string;
  access_token: string;
  token_expires_at: string | null;
};

export type InstagramCredentials = {
  accessToken: string;
  oauthInstagramUserId: string;
  tokenExpiresAt: string | null;
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const findActiveInstagramConnection = async (
  supabase: AdminClient,
  organizationId: number,
  preferredExternalAccountId?: string | null,
) => {
  const { data: connections, error } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id, access_token, token_expires_at, connected_at")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .not("access_token", "is", null)
    .order("connected_at", { ascending: false, nullsFirst: false });

  if (error || !connections?.length) {
    return null;
  }

  const usable = connections.filter(
    (row) => typeof row.access_token === "string" && row.access_token.length > 0,
  ) as InstagramConnectionRow[];

  if (!usable.length) {
    return null;
  }

  if (preferredExternalAccountId) {
    const matched = usable.find((row) => row.instagram_user_id === preferredExternalAccountId);
    if (matched) {
      return matched;
    }
  }

  return usable[0] ?? null;
};

export const syncInstagramTokenToOrganizationAccounts = async (
  supabase: AdminClient,
  organizationId: number,
  credentials: InstagramCredentials,
) => {
  const { data: accounts, error } = await supabase
    .from("channel_accounts")
    .select("id, access_token, metadata")
    .eq("organization_id", organizationId)
    .eq("channel", "instagram");

  if (error || !accounts?.length) {
    return;
  }

  for (const account of accounts) {
    if (account.access_token === credentials.accessToken) {
      continue;
    }

    const metadata = {
      ...asMetadata(account.metadata),
      provider: "instagram",
      oauth_instagram_user_id: credentials.oauthInstagramUserId,
      ...(credentials.tokenExpiresAt ? { token_expires_at: credentials.tokenExpiresAt } : {}),
    };

    await supabase
      .from("channel_accounts")
      .update({
        access_token: credentials.accessToken,
        metadata,
      })
      .eq("id", account.id)
      .eq("organization_id", organizationId);
  }
};

export const resolveInstagramCredentials = async (options: {
  organizationId: number;
  channelAccountId?: number | null;
  supabase?: AdminClient;
}): Promise<InstagramCredentials | null> => {
  const supabase = options.supabase ?? getSupabaseAdminClient();

  let channelAccount: {
    id: number;
    external_account_id: string | null;
    access_token: string | null;
    metadata: unknown;
  } | null = null;

  if (options.channelAccountId) {
    const { data } = await supabase
      .from("channel_accounts")
      .select("id, external_account_id, access_token, metadata")
      .eq("id", options.channelAccountId)
      .eq("organization_id", options.organizationId)
      .eq("channel", "instagram")
      .maybeSingle();
    channelAccount = data;
  }

  const connection = await findActiveInstagramConnection(
    supabase,
    options.organizationId,
    channelAccount?.external_account_id,
  );

  const accessToken = connection?.access_token || channelAccount?.access_token || null;
  if (!accessToken) {
    return null;
  }

  const metadata = asMetadata(channelAccount?.metadata);
  const metadataOAuthId =
    typeof metadata.oauth_instagram_user_id === "string" ? metadata.oauth_instagram_user_id : null;

  const credentials: InstagramCredentials = {
    accessToken,
    oauthInstagramUserId:
      connection?.instagram_user_id ||
      metadataOAuthId ||
      channelAccount?.external_account_id ||
      "",
    tokenExpiresAt: connection?.token_expires_at ?? null,
  };

  if (connection) {
    await syncInstagramTokenToOrganizationAccounts(supabase, options.organizationId, credentials);
  }

  return credentials;
};
