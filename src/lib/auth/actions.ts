"use server";

import { redirect } from "next/navigation";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { loginSchema } from "@/lib/auth/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const signIn = async (rawValues: unknown) => {
  const parsed = loginSchema.safeParse(rawValues);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: getAuthErrorMessage(error.message) };
  }

  redirect("/inbox");
};

export const signOut = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
};
