import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import Sank from "./sank";
import InstallHint from "./install-hint";

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
    <main className="flex flex-1 flex-col">
      <Sank
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
      />
      <InstallHint />
    </main>
  );
}
