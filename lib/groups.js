// Grupe: članstva i aktivna grupa korisnika. RLS pušta samo vlastita
// članstva, pa userId služi čitljivosti — filter je svejedno na bazi.

export async function getMyGroups(supabase, userId) {
  const { data } = await supabase
    .from("group_members")
    .select("group_id, role, joined_at, groups(name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.group_id,
    name: m.groups?.name ?? "Grupa",
    role: m.role,
  }));
}

// Aktivna grupa: profiles.active_group_id ako je i dalje član, inače prva
// grupa (fallback za slučaj izbacivanja/napuštanja)
export async function getActiveGroup(supabase, userId) {
  const [{ data: profile }, groups] = await Promise.all([
    supabase
      .from("profiles")
      .select("active_group_id")
      .eq("id", userId)
      .maybeSingle(),
    getMyGroups(supabase, userId),
  ]);

  const active =
    groups.find((g) => g.id === profile?.active_group_id) ?? groups[0] ?? null;

  return { active, groups };
}
