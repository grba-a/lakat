import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveGroupFor } from "@/lib/auth";
import { countActiveFriends } from "@/lib/friends";
import Nav from "./nav";
import OfflineBanner from "./offline-banner";
import PresenceHeartbeat from "./presence-heartbeat";
import GroupSwitcher from "./group-switcher";
import FriendsBadge from "./friends-badge";

export default async function MainLayout({ children }) {
  const user = await getUser();

  let active = null;
  let groups = [];
  let activeFriends = 0;
  if (user) {
    const supabase = await createClient();
    const [groupData, friends] = await Promise.all([
      getActiveGroupFor(user.id),
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
        className="flex items-center"
        style={{ viewTransitionName: "app-header" }}
      >
        <div className="flex-1">
          <p className="font-display text-3xl uppercase leading-none tracking-tight">
            Lakat<span className="text-accent">.</span>
          </p>
        </div>
        <div className="flex flex-1 justify-center">
          {active && groups.length > 1 && (
            <GroupSwitcher groups={groups} activeId={active.id} />
          )}
        </div>
        <div className="flex flex-1 justify-end">
          <FriendsBadge initialCount={activeFriends} />
        </div>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav />
    </div>
  );
}
