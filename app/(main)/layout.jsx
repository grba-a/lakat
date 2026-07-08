import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveGroup } from "@/lib/groups";
import { countActiveFriends } from "@/lib/friends";
import Nav from "./nav";
import OfflineBanner from "./offline-banner";
import PresenceHeartbeat from "./presence-heartbeat";
import GroupSwitcher from "./group-switcher";
import FriendsBadge from "./friends-badge";

export default async function MainLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let active = null;
  let groups = [];
  let activeFriends = 0;
  if (user) {
    const [groupData, friends] = await Promise.all([
      getActiveGroup(supabase, user.id),
      countActiveFriends(supabase, user.id),
    ]);
    active = groupData.active;
    groups = groupData.groups;
    activeFriends = friends;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-36 pt-6">
      <OfflineBanner />
      <PresenceHeartbeat />
      <header
        className="flex items-center gap-3"
        style={{ viewTransitionName: "app-header" }}
      >
        <p className="font-display text-3xl uppercase leading-none tracking-tight">
          Lakat<span className="text-accent">.</span>
        </p>
        {active && groups.length > 1 && (
          <GroupSwitcher groups={groups} activeId={active.id} />
        )}
        <div className="ml-auto">
          <FriendsBadge initialCount={activeFriends} />
        </div>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav />
    </div>
  );
}
