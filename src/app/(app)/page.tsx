import { PlateMorph, Screen } from "@/components/screen";
import Link from "next/link";
import { AlertIcon, ChevronRight, ClockIcon, LayersIcon } from "@/components/icons";
import { SearchPanel } from "@/components/search";
import { Card, LegacyStatus, Plate } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { getRecentVehicles, getSearchIndex } from "@/lib/data";

function timeAgo(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const [items, recent, { q }] = await Promise.all([getSearchIndex(user.role === "ADMIN"), getRecentVehicles(user.id), searchParams]);
  const active = items.filter((i) => !i.archived);

  const groups = new Map<string, { id: string; name: string; count: number }>();
  for (const i of active) {
    const g = groups.get(i.groupId) ?? { id: i.groupId, name: i.group, count: 0 };
    g.count++;
    groups.set(i.groupId, g);
  }
  const status = (s: string | null) => active.filter((i) => i.legacyStatus === s).length;
  const situations = [
    { key: "OK", label: "OK", n: status("OK") },
    { key: "ATRASADO", label: "ATRASADO", n: status("ATRASADO") },
    { key: "PENDENTE", label: "PENDENTE", n: status("PENDENTE") },
    { key: "_vazio", label: null, n: status(null) },
  ];
  const review = active.filter((i) => i.needsReview);

  return (
    <Screen className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:pt-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-14">
      <div className="min-w-0">
        <h1 className="mb-1.5 text-[30px] font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">Qual veículo?</h1>
        <p className="mb-6 text-[15px] text-muted md:mb-8 md:text-base">Digite ou cole a placa. Também vale RENAVAM ou chassi.</p>
        <SearchPanel
          items={items}
          isAdmin={user.role === "ADMIN"}
          variant="hero"
          autoFocus
          initialQuery={typeof q === "string" ? q.slice(0, 40) : ""}
          emptyContent={
            <section aria-labelledby="recentes" className="fade-in mt-10">
              <h2 id="recentes" className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted">
                <ClockIcon size={16} /> Acessados recentemente
              </h2>
              {recent.length > 0 ? (
                <ul className="stagger grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {recent.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/veiculos/${v.id}`}
                        transitionTypes={["nav-forward"]}
                        className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgb(20_22_27/0.25)] hover:ring-line-strong active:scale-[0.99]"
                      >
                        <PlateMorph id={v.id}>
                          <Plate plate={v.plate} size="sm" />
                        </PlateMorph>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{v.makeModel ?? "—"}</span>
                          <span className="block truncate text-xs text-muted">
                            {v.group.name} · {timeAgo(v.viewedAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-sm text-muted">
                  Os veículos que você abrir aparecem aqui para acesso rápido.
                </p>
              )}
            </section>
          }
        />
      </div>

      <aside className="min-w-0 space-y-5" aria-label="Atalhos da frota">
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <LayersIcon size={18} /> Frota
            </h2>
            <Link href="/veiculos" className="text-[13px] font-medium text-accent underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          <p className="mb-4 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular">
            {active.length}
            <span className="ml-2 text-[14px] font-normal tracking-normal text-muted">veículos em {groups.size} grupos</span>
          </p>
          <ul className="-mx-2">
            {[...groups.values()].map((g) => (
              <li key={g.id}>
                <Link href={`/veiculos?grupo=${g.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{g.name}</span>
                  <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent/70" style={{ width: `${Math.max(6, (g.count / active.length) * 100)}%` }} />
                  </span>
                  <span className="w-7 text-right text-[13px] tabular text-muted">{g.count}</span>
                  <ChevronRight size={16} className="text-muted opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-[15px] font-semibold">Situação na planilha</h2>
          <p className="mb-4 text-xs text-muted">Rótulo herdado da planilha, não é cálculo de vencimento.</p>
          <div className="grid grid-cols-2 gap-2">
            {situations.map((s) => (
              <Link
                key={s.key}
                href={`/veiculos?situacao=${s.key}`}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 ring-1 ring-line transition hover:ring-line-strong"
              >
                {s.label ? <LegacyStatus value={s.label} /> : <span className="text-xs font-medium text-muted">Sem situação</span>}
                <span className="text-[15px] font-semibold tabular">{s.n}</span>
              </Link>
            ))}
          </div>
        </Card>

        {review.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-warn">
              <AlertIcon size={18} /> Para revisar
            </h2>
            <ul className="space-y-2">
              {review.map((v) => (
                <li key={v.id}>
                  <Link href={`/veiculos/${v.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-surface-2">
                    <Plate plate={v.plate} size="sm" />
                    <span className="truncate text-[13px] text-muted">Placa fora do padrão</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </Screen>
  );
}
