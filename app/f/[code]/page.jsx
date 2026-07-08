import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Avatar from "@/app/(main)/avatar";
import AddByLinkButton from "./add-button";

export default async function FriendLinkPage({ params }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalized = code?.toString().trim().toUpperCase();

  // Prije bilo kakvog prijateljstva RLS ne pušta tuđi profil — admin
  // klijent samo za resolve koda, isto kao kod prijave šifrom grupe
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("friend_code", normalized)
    .maybeSingle();
  if (!target) notFound();
  if (target.id === user.id) redirect("/profil/frendovi");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 py-10 text-center">
      <Avatar username={target.username} avatarUrl={target.avatar_url} size={96} />
      <h1 className="mt-4 font-display text-4xl uppercase leading-none tracking-tight">
        {target.username}
        <span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-sm text-muted">Zove te za pajdaša.</p>

      <AddByLinkButton code={normalized} />
    </main>
  );
}
