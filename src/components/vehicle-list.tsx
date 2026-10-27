"use client";

import { PlateMorph } from "./screen";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
import { searchVehicles, type SearchItem } from "@/lib/search";
import { ChevronRight, FileIcon, PlusIcon, SearchIcon, XIcon } from "./icons";
import { Badge, ButtonLink, EmptyState, LegacyStatus, Plate, Select, cx, inputClass } from "./ui";

export type ListItem = SearchItem & { inspection: string | null; docs: number; year: string | null };

const STATUS = [
  { value: "", label: "Todas as situações" },
  { value: "OK", label: "OK" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "_vazio", label: "Sem situação" },
];

const WIDE = "(min-width: 768px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Só a versão visível (tabela ou lista) leva o nome da transição: nomes repetidos quebram a animação. */
function MaybeMorph({ on, id, children }: { on: boolean; id: string; children: React.ReactNode }) {
  return on ? <PlateMorph id={id}>{children}</PlateMorph> : <>{children}</>;
}

export function VehicleList({ items, groups, isAdmin }: { items: ListItem[]; groups: { id: string; name: string; count: number }[]; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const group = params.get("grupo") ?? "";
  const status = params.get("situacao") ?? "";
  const archived = params.get("arquivados") === "1";
  const [text, setText] = useState(params.get("q") ?? "");
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
  const q = useDeferredValue(text);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const rows = useMemo(() => {
    let r = items.filter(
      (i) =>
        i.archived === archived &&
        (!group || i.groupId === group) &&
        (!status || (status === "_vazio" ? !i.legacyStatus : i.legacyStatus === status)),
    );
    if (q.trim()) r = searchVehicles(r, q, 500).map((h) => h.item as ListItem);
    return r;
  }, [items, archived, group, status, q]);

  const filtered = !!(group || status || q.trim() || archived);

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] md:mb-5">
        <label className="relative block min-w-0">
          <span className="sr-only">Filtrar lista</span>
          <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            type="search"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Filtrar por placa, modelo, RENAVAM…"
            className={cx(inputClass, "h-11 pl-10")}
          />
        </label>
        <Select value={group} onChange={(e) => setParam("grupo", e.target.value)} aria-label="Grupo" className="sm:w-56">
          <option value="">Todos os grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.count})
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setParam("situacao", e.target.value)} aria-label="Situação legada" className="sm:w-48">
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2 text-sm text-muted">
        <span className="tabular">
          <strong className="font-semibold text-ink">{rows.length}</strong> {rows.length === 1 ? "veículo" : "veículos"}
          {archived && " arquivados"}
        </span>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setText("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-ink/10"
          >
            <XIcon size={12} /> Limpar filtros
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setParam("arquivados", archived ? "" : "1")}
            className="ml-auto text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {archived ? "Ver ativos" : "Ver arquivados"}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface ring-1 ring-line">
          <EmptyState
            title={filtered ? "Nenhum veículo com esses filtros" : "Nenhum veículo cadastrado"}
            action={
              isAdmin && !archived ? (
                <ButtonLink href={`/veiculos/novo${q.trim().length >= 5 ? `?placa=${encodeURIComponent(q.trim())}` : ""}`} variant="accent">
                  <PlusIcon size={18} /> Cadastrar veículo
                </ButtonLink>
              ) : undefined
            }
          >
            {filtered ? "Ajuste ou limpe os filtros para ver mais resultados." : null}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-2xl bg-surface ring-1 ring-line md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-line bg-surface-2 text-[12px] font-medium uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Placa</th>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">RENAVAM</th>
                  <th className="px-4 py-3 font-medium">Vistoria</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 text-right font-medium">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="group relative transition-colors hover:bg-accent-soft/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/veiculos/${v.id}`} transitionTypes={["nav-forward"]} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent">
                        <MaybeMorph on={wide} id={v.id}>
                          <Plate plate={v.plate} size="sm" />
                        </MaybeMorph>
                      </Link>
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-2.5 font-medium">{v.makeModel ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-ink-2">{v.group}</td>
                    <td className="px-4 py-2.5 font-mono text-[13px] tabular text-ink-2">{v.renavam ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-2">{v.inspection ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <LegacyStatus value={v.legacyStatus} />
                        {v.needsReview && <Badge tone="warn">Revisar</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular text-ink-2">{v.docs || <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: lista tocável */}
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line md:hidden">
            {rows.map((v) => (
              <li key={v.id}>
                <Link href={`/veiculos/${v.id}`} transitionTypes={["nav-forward"]} className="flex items-center gap-3 px-4 py-3.5 active:bg-ink/[0.04]">
                  <MaybeMorph on={!wide} id={v.id}>
                    <Plate plate={v.plate} size="sm" />
                  </MaybeMorph>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{v.makeModel ?? "—"}</span>
                    <span className="flex items-center gap-1.5 truncate text-[13px] text-muted">
                      <span className="truncate">{v.group}</span>
                      {v.docs > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5">
                          · <FileIcon size={12} /> {v.docs}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {v.needsReview ? <Badge tone="warn">Revisar</Badge> : <LegacyStatus value={v.legacyStatus} />}
                    <ChevronRight size={18} className="text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
