import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import { logout } from "./actions";
import Sank from "./sank";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }] = await Promise.all([
    supabase.from("profiles").select("id, username").order("username"),
    supabase
      .from("checkins")
      .select("user_id, checked_in_at")
      .gte("checked_in_at", dayStart.toISOString())
      .order("checked_in_at", { ascending: true }),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase leading-none tracking-tight">
          Lakat<span className="text-accent">.</span>
        </h1>
        <form action={logout}>
          <button
            type="submit"
            className="px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted underline underline-offset-4"
          >
            Odjava
          </button>
        </form>
      </header>

      <Sank
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
      />
    </main>
  );
}
