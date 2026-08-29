import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const hasSupabaseAuthCookie = (store: Awaited<ReturnType<typeof cookies>>) =>
  store.getAll().some((cookie) => cookie.name.includes("-auth-token"));

const Home = async () => {
  const store = await cookies();
  redirect(hasSupabaseAuthCookie(store) ? "/home" : "/login");
};

export default Home;
