import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import JoinByLinkButton from "./join-button";

export default async function GroupInvitePage({ params }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalized = code?.toString().trim().toUpperCase();

  // Ne-član ne vidi tuđu grupu kroz RLS — admin klijent samo za resolve
  // koda, isto kao /f/[code] za friend kod
  const admin = createAdminClient();
  const { data: group } = await admin
    .from("groups")
    .select("id, name")
    .eq("invite_code", normalized)
    .maybeSingle();
  if (!group) notFound();

  const [{ data: membership }, { count: memberCount }] = await Promise.all([
    admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id),
  ]);
  if (membership) redirect("/");

  const n = memberCount ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        Zovu te u grupu
      </p>
      <h1 className="mt-3 font-display text-5xl uppercase leading-none tracking-tight">
        {group.name}
        <span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm text-muted">
        {`${n} ${n === 1 ? "pjanac" : n % 100 >= 2 && n % 100 <= 4 ? "pjanca" : "pjanaca"} te čeka`} za šankom.
      </p>

      <JoinByLinkButton code={normalized} />
    </main>
  );
}
