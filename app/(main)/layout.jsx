import { ViewTransition } from "react";
import Nav from "./nav";
import OfflineBanner from "./offline-banner";
import PresenceHeartbeat from "./presence-heartbeat";

export default function MainLayout({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-36 pt-6">
      <OfflineBanner />
      <PresenceHeartbeat />
      <header
        className="flex items-center justify-between"
        style={{ viewTransitionName: "app-header" }}
      >
        <p className="font-display text-3xl uppercase leading-none tracking-tight">
          Lakat<span className="text-accent">.</span>
        </p>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav />
    </div>
  );
}
