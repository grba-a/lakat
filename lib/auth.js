import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// React.cache dedup po requestu — layout i stranica dijele isti getUser
// poziv umjesto da svaki radi svoj (manje auth round-tripova po navigaciji).
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
