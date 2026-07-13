import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { countActiveFriends } from "@/lib/friends";
import { getCurrentDayStart } from "@/lib/day";
import Nav from "./nav";
import OfflineBanner from "./offline-banner";
import PresenceHeartbeat from "./presence-heartbeat";
import GroupSwitcher from "./group-switcher";
import FriendsBadge from "./friends-badge";
import KoloIcon from "./kolo-icon";

export default async function MainLayout({ children }) {
  const user = await getUser();

  let active = null;
  let groups = [];
  let activeFriends = 0;
  let koloSpun = false;
  if (user) {
    const supabase = await createClient();
    const [groupData, friends, { data: todaysSpin }] = await Promise.all([
      getActiveGroupFor(user.id),
      countActiveFriends(supabase, user.id),
      // Piće dana: 1 spin dnevno po korisniku, bez obzira na grupu
      supabase
        .from("kolo_spins")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", getCurrentDayStart().toISOString())
        .limit(1),
    ]);
    active = groupData.active;
    groups = groupData.groups;
    activeFriends = friends;
    koloSpun = Boolean(todaysSpin?.length);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-36 pt-6">
      <OfflineBanner />
      <PresenceHeartbeat />
      <header
        className="flex items-center"
        style={{ viewTransitionName: "app-header" }}
      >
        <div className="flex-1">
          <Link
            href="/"
            aria-label="Na Šank"
            className="pressable inline-block font-display text-3xl uppercase leading-none tracking-tight"
          >
            Lakat<span className="text-accent">.</span>
          </Link>
        </div>
        <div className="flex flex-1 justify-center">
          {active && groups.length > 1 && (
            <GroupSwitcher groups={groups} activeId={active.id} />
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {active && <KoloIcon initialSpun={koloSpun} />}
          <FriendsBadge initialCount={activeFriends} />
        </div>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav />
    </div>
  );
}
