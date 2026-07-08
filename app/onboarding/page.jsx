import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/groups";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, groups] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
    getMyGroups(supabase, user.id),
  ]);

  // Već sve ima — nema mu se tu što motati
  if (profile && groups.length > 0) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
        Skoro gotovo<span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm uppercase tracking-widest text-muted">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
        Još samo grupa i ideš za šank.
      </p>
      <OnboardingForm needsUsername={!profile} />
    </main>
  );
}
