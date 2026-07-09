import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveGroup } from "@/lib/groups";

// React.cache dedup po requestu — layout i stranica dijele isti getUser /
// getActiveGroup poziv umjesto da svaki radi svoj (manje auth round-tripova
// i DB upita po navigaciji).
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getActiveGroupFor = cache(async (userId) => {
  const supabase = await createClient();
  return getActiveGroup(supabase, userId);
});
