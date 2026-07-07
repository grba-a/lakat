import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/groups";
import { logout } from "@/app/actions";
import PushToggle from "../push-toggle";
import UsernameForm from "../username-form";
import PasswordForm from "../password-form";
import MojeGrupe from "./moje-grupe";

export default async function PostavkePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, groups] = await Promise.all([
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle(),
    getMyGroups(supabase, user.id),
  ]);

  // Članovi svih mojih grupa u jednom upitu (RLS pušta samo vlastite grupe)
  const groupIds = groups.map((g) => g.id);
  const { data: memberRows } = groupIds.length
    ? await supabase
        .from("group_members")
        .select("group_id, user_id, role, profiles(username)")
        .in("group_id", groupIds)
        .order("joined_at", { ascending: true })
    : { data: [] };

  const grupe = groups.map((g) => ({
    ...g,
    members: (memberRows ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        id: m.user_id,
        username: m.profiles?.username ?? "Netko",
        role: m.role,
      })),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <Link
        href="/profil"
        className="pressable mt-6 inline-flex w-fit items-center gap-1 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted active:bg-white/5"
      >
        ← Profil
      </Link>

      <section className="mt-4">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Postavke<span className="text-accent">.</span>
        </h1>
      </section>

      <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Račun
        </h2>
        <div className="stagger mt-4 flex flex-col gap-3">
          <div style={{ "--stagger-i": 0 }}>
            <UsernameForm username={profile?.username ?? ""} />
          </div>
          <div style={{ "--stagger-i": 1 }}>
            <PasswordForm />
          </div>
        </div>
      </section>

      <MojeGrupe groups={grupe} myId={user.id} />

      <section className="mt-10">
        <form action={logout}>
          <button
            type="submit"
            className="pressable-soft h-14 w-full rounded-button border border-danger/30 bg-danger/10 font-display text-xl uppercase tracking-wide text-danger"
          >
            Odjavi me
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Odjava iz aplikacije. Šank te neće zaboraviti, bez brige.
        </p>
      </section>
    </main>
  );
}
