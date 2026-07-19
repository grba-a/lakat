import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { getDayKey } from "@/lib/day";
import { addDays } from "@/lib/stats";
import { friendIdsOf } from "@/lib/friends";
import {
  computeRang,
  weekStartKey,
  bodovaLabel,
  BOD_DOLAZAK,
  BOD_ODAZIV,
  BOD_KADAR,
  BOD_IZAZOV,
} from "@/lib/rang";
import Avatar from "../avatar";
import BrandPunct from "@/app/brand-punct";

const dateFmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "UTC",
  day: "numeric",
  month: "numeric",
});

function formatDayKey(dayKey) {
  return dateFmt.format(new Date(`${dayKey}T00:00:00Z`));
}

const MEDALS = ["🥇", "🥈", "🥉"];

// Rang 3.0: tjedna ljestvica MOJIH pajdaša + moja globalna pozicija kao
// broj. Nema javne globalne ljestvice s imenima — privatnost samo-frendovi.
export default async function RangPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const todayKey = getDayKey(new Date());
  const weekKey = weekStartKey(todayKey);

  const friendIds = await friendIdsOf(supabase, user.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", [user.id, ...friendIds]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rang = await computeRang({
    admin: createAdminClient(),
    userId: user.id,
    friendIds,
    weekKey,
  });
  const izazov = rang.mine.izazov;

  return (
    <main className="flex flex-1 flex-col">
      <section className="mt-8">
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight">
          Rang<BrandPunct>.</BrandPunct>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tjedan {formatDayKey(weekKey)} – {formatDayKey(addDays(weekKey, 6))} ·
          Tko se najviše druži?
        </p>
      </section>

      {/* Globalna pozicija — samo broj, bez tuđih imena */}
      <section className="mt-6">
        <div className="rounded-card border border-accent/30 bg-accent/10 px-5 py-4 shadow-glow">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Ovaj tjedan u svijetu
          </p>
          <p className="mt-1 font-display text-4xl uppercase leading-none tracking-tight text-accent">
            #{rang.globalRank}
          </p>
          <p className="mt-1 text-sm text-muted">
            od {rang.globalTotal}{" "}
            {rang.globalTotal === 1
              ? "pjanca koji je izašao"
              : "pjanaca koji su izašli"}{" "}
            · {bodovaLabel(rang.mine.points)}
          </p>
        </div>
      </section>

      {/* Osobni izazov tjedna */}
      {izazov && (
        <section className="mt-6">
          <div
            className={`rounded-card border px-5 py-4 ${
              izazov.done
                ? "border-accent/30 bg-accent/[0.06]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              🎯 Tvoj izazov tjedna · +{BOD_IZAZOV}
            </p>
            <p
              className={`mt-1 font-display text-2xl uppercase leading-none tracking-tight ${
                izazov.done ? "text-accent" : ""
              }`}
            >
              {izazov.label}
              {izazov.done && " ✓"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {izazov.done
                ? "Ispunjeno. Bodovi su tvoji, jetra je tvoj problem."
                : izazov.description}
            </p>
          </div>
        </section>
      )}

      {/* Ljestvica frend kruga */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Moji pajdaši
        </h2>
        {rang.ljestvica.length <= 1 ? (
          <p className="mt-4 text-sm text-muted">
            Nemaš pajdaša za usporedbu. Dodaj ih pa se natječi.
          </p>
        ) : (
          <ul className="stagger mt-4 flex flex-col gap-2">
            {rang.ljestvica.map((e, i) => {
              const p = profileById.get(e.id);
              const isMe = e.id === user.id;
              return (
                <li
                  key={e.id}
                  className={`surface-2 rounded-row ${
                    isMe ? "border-accent/40 bg-accent/[0.08]" : ""
                  }`}
                  style={{ "--stagger-i": Math.min(i, 8) }}
                >
                  <div className="flex h-14 items-center justify-between px-4">
                    <span className="flex min-w-0 items-center gap-3 font-bold">
                      <span className="w-7 shrink-0 text-lg">
                        {MEDALS[i] ?? `${i + 1}.`}
                      </span>
                      <Avatar
                        username={p?.username ?? "?"}
                        avatarUrl={p?.avatar_url}
                        size={28}
                      />
                      <span className={`truncate ${isMe ? "text-accent" : ""}`}>
                        {p?.username ?? "Netko"}
                        {isMe && " (ja)"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold uppercase tracking-widest ${
                        isMe ? "text-accent" : "text-muted"
                      }`}
                    >
                      {bodovaLabel(e.points)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Kako se boduje
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          <li>
            📸 Dolazak (runda) —{" "}
            <span className="font-bold text-foreground">+{BOD_DOLAZAK}</span>{" "}
            po danu
          </li>
          <li>
            📣 Poziv ispoštovan —{" "}
            <span className="font-bold text-foreground">+{BOD_ODAZIV}</span>{" "}
            povrh dolaska
          </li>
          <li>
            👥 Zajednički kadar (2+ na slici) —{" "}
            <span className="font-bold text-foreground">+{BOD_KADAR}</span>{" "}
            po danu
          </li>
          <li>
            🎯 Tvoj izazov tjedna ispunjen —{" "}
            <span className="font-bold text-foreground">+{BOD_IZAZOV}</span>{" "}
            (novi svaki ponedjeljak, piše gore)
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Rang se resetira ponedjeljkom u 06:00. Više izlazaka = više bodova.
          Matematika je jednostavna: druži se.
        </p>
      </section>
    </main>
  );
}
