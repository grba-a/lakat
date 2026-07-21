import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import QrClient from "./qr-client";

export default async function QrPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: me } = await supabase
    .from("profiles")
    .select("friend_code")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Moj QR<span className="text-accent">.</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          Pokaži pajdašu, skeniraj njegov, ili podijeli link.
        </p>
      </section>

      <QrClient myCode={me?.friend_code} />
    </main>
  );
}
