import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayStart } from "@/lib/day";
import Sank from "./sank";
import Memorije from "./memorije";
import InstallHint from "./install-hint";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dayStart = getCurrentDayStart();
  const [{ data: profiles }, { data: checkins }, { data: memories }] =
    await Promise.all([
      supabase.from("profiles").select("id, username, avatar_url").order("username"),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, cancelled_at, photo_url")
        .gte("checked_in_at", dayStart.toISOString())
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("checkins")
        .select("id, user_id, checked_in_at, photo_url")
        .not("photo_url", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(30),
    ]);

  const usernames = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const memoryItems = (memories ?? []).map((m) => ({
    ...m,
    username: usernames.get(m.user_id) ?? "Netko",
  }));

  return (
    <main className="flex flex-1 flex-col">
      <Sank
        profiles={profiles ?? []}
        initialCheckins={checkins ?? []}
        currentUserId={user.id}
      />
      <Memorije items={memoryItems} />
      <InstallHint />
    </main>
  );
}
