import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlatformAdminEmail } from "@/lib/billing/platform-admin";

export const requirePlatformAdminSession = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!isPlatformAdminEmail(user.email)) {
    redirect("/home");
  }

  return { user, supabase };
};
