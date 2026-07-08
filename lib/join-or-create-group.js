// Zajednička logika pridruživanja/osnivanja grupe — koriste je i email
// registracija i OAuth onboarding, moraju ostati usklađene (validacija,
// RPC pozivi na hashiranu šifru, RLS-bypass upisi kroz admin klijent).
export async function joinOrCreateGroup(
  admin,
  userId,
  { mode, groupName, groupPassword, groupConfirm }
) {
  if (!groupName || !groupPassword) {
    return { error: "Popuni sva polja, nije ovo raketna znanost." };
  }
  if (groupName.length < 2 || groupName.length > 32) {
    return { error: "Naziv grupe mora imati između 2 i 32 znaka." };
  }
  if (mode !== "join" && mode !== "create") {
    return { error: "Odaberi: upadaš u postojeću grupu ili osnivaš novu." };
  }
  if (mode === "create") {
    if (groupPassword.length < 4) {
      return { error: "Šifra grupe mora imati bar 4 znaka." };
    }
    if (groupPassword !== groupConfirm) {
      return { error: "Šifre grupe se ne poklapaju. Otriježni se pa probaj opet." };
    }
  }

  let groupId;
  if (mode === "join") {
    const { data: gid, error: verifyError } = await admin.rpc(
      "verify_group_password",
      { g_name: groupName, g_password: groupPassword }
    );
    if (verifyError) {
      return { error: `Provjera grupe nije prošla: ${verifyError.message}` };
    }
    if (!gid) {
      return { error: "Ta grupa ne postoji ili si fulao šifru. Otriježni se." };
    }
    groupId = gid;
  } else {
    const { data: hash, error: hashError } = await admin.rpc("hash_group_password", {
      pw: groupPassword,
    });
    if (hashError) {
      return { error: `Grupa se nije kreirala: ${hashError.message}` };
    }
    const { data: created, error: groupError } = await admin
      .from("groups")
      .insert({ name: groupName, password_hash: hash, created_by: userId })
      .select("id")
      .single();
    if (groupError) {
      if (groupError.code === "23505") {
        return {
          error: `Grupa "${groupName}" već postoji. Pridruži joj se ili smisli drugo ime.`,
        };
      }
      return { error: `Grupa se nije kreirala: ${groupError.message}` };
    }
    groupId = created.id;
  }

  const { error: memberError } = await admin
    .from("group_members")
    .upsert(
      { group_id: groupId, user_id: userId, role: mode === "create" ? "admin" : "member" },
      { onConflict: "group_id,user_id", ignoreDuplicates: true }
    );
  if (memberError) {
    return { error: `Upis u grupu nije prošao: ${memberError.message}` };
  }

  await admin.from("profiles").update({ active_group_id: groupId }).eq("id", userId);

  return { groupId };
}
