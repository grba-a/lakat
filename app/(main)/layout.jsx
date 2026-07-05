import { ViewTransition } from "react";
import { logout } from "@/app/actions";
import Nav from "./nav";

export default function MainLayout({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-36 pt-6">
      <header
        className="flex items-center justify-between"
        style={{ viewTransitionName: "app-header" }}
      >
        <p className="font-display text-3xl uppercase leading-none tracking-tight">
          Lakat<span className="text-accent">.</span>
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="pressable rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted active:bg-white/5"
          >
            Odjava
          </button>
        </form>
      </header>
      <ViewTransition default="page-cross">{children}</ViewTransition>
      <Nav />
    </div>
  );
}
