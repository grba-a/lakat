import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { countActiveFriends } from "@/lib/friends";
import Nav from "./nav";
import OfflineBanner from "./offline-banner";
import PresenceHeartbeat from "./presence-heartbeat";
import FriendsBadge from "./friends-badge";

export default async function MainLayout({ children }) {
  const user = await getUser();

  let activeFriends = 0;
  if (user) {
    const supabase = await createClient();
    activeFriends = await countActiveFriends(supabase, user.id);
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
        <div className="flex flex-1 justify-center" />
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <FriendsBadge initialCount={activeFriends} />
        </div>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav userId={user?.id ?? null} />
    </div>
  );
}
