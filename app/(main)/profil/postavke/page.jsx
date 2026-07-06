import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import PushToggle from "../push-toggle";
import UsernameForm from "../username-form";
import PasswordForm from "../password-form";

export default async function PostavkePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

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
