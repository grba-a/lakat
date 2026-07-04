import { logout } from "@/app/actions";
import Nav from "./nav";

export default function MainLayout({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <p className="font-display text-3xl uppercase leading-none tracking-tight">
          Lakat<span className="text-accent">.</span>
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="px-2 py-2 text-xs font-bold uppercase tracking-widest text-muted underline underline-offset-4"
          >
            Odjava
          </button>
        </form>
      </header>
      {children}
      <Nav />
    </div>
  );
}
