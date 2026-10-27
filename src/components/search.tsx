"use client";

import { PlateMorph } from "./screen";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { plateKey } from "@/lib/plate";
import { searchVehicles, type SearchHit, type SearchItem } from "@/lib/search";
import { AlertIcon, ChevronRight, PlusIcon, SearchIcon, XIcon } from "./icons";
import { DialogShell } from "./sheet";
import { Badge, ButtonLink, LegacyStatus, Plate, cx } from "./ui";

function matchHint(h: SearchHit) {
  if (h.field === "renavam") return `RENAVAM ${h.item.renavam}`;
  if (h.field === "chassi") return `Chassi ${h.item.chassis}`;
  return null;
}

export function SearchPanel({
  items,
  isAdmin,
  autoFocus,
  variant,
  onNavigate,
  emptyContent,
  initialQuery = "",
}: {
  items: SearchItem[] | null;
  isAdmin: boolean;
  autoFocus?: boolean;
  variant: "hero" | "palette";
  onNavigate?: () => void;
  emptyContent?: React.ReactNode;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const deferred = useDeferredValue(query);
  const [sel, setSel] = useState({ q: "", i: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hits = useMemo(() => (items ? searchVehicles(items, deferred, 40) : []), [items, deferred]);
  const key = plateKey(query);

  // O destaque volta ao primeiro resultado sempre que a busca muda.
  const active = sel.q === deferred ? sel.i : 0;
  const setActive = (f: (i: number) => number) => setSel({ q: deferred, i: f(active) });
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const go = (id: string) => {
    onNavigate?.();
    router.push(`/veiculos/${id}`, { transitionTypes: ["nav-forward"] });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active].item.id);
    }
  };

  const hero = variant === "hero";
  return (
    <div className="min-w-0">
      <div
        className={cx(
          "group flex items-center gap-3 bg-surface transition-shadow",
          hero
            ? "h-16 rounded-2xl px-4 shadow-[0_1px_2px_rgb(20_22_27/0.06),0_8px_24px_-12px_rgb(20_22_27/0.18)] ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-accent md:h-[72px] md:px-5"
            : "h-14 border-b border-line px-4",
        )}
      >
        <SearchIcon size={hero ? 24 : 20} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
          aria-label="Buscar por placa, RENAVAM ou chassi"
          placeholder={hero ? "Placa, RENAVAM ou chassi" : "Buscar placa, RENAVAM ou chassi…"}
          className={cx(
            "h-full min-w-0 flex-1 bg-transparent font-medium focus-visible:outline-none tracking-[-0.01em] text-ink outline-none placeholder:font-normal placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden",
            hero ? "text-[20px] md:text-[24px]" : "text-[17px]",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Limpar busca"
          >
            <XIcon size={18} />
          </button>
        )}
        {hero && !query && (
          <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 font-sans text-xs text-muted md:inline">Ctrl K</kbd>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {query && items ? (hits.length ? `${hits.length} resultado(s)` : "Nenhum resultado") : ""}
      </div>

      {!query && emptyContent}

      {query && !items && <p className="px-4 py-6 text-sm text-muted">Carregando…</p>}

      {query && items && hits.length > 0 && (
        <ul id={listId} role="listbox" className={cx("fade-in", hero ? "mt-3 overflow-hidden rounded-2xl bg-surface ring-1 ring-line" : "max-h-[60dvh] overflow-y-auto py-1")}>
          {hits.map((h, i) => (
            <li
              key={h.item.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(() => i)}
              onClick={() => go(h.item.id)}
              className={cx(
                "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors md:gap-4",
                hero && "border-b border-line last:border-0",
                i === active ? "bg-accent-soft/60" : "hover:bg-surface-2",
              )}
            >
              {hero ? (
                <PlateMorph id={h.item.id}>
                  <Plate plate={h.item.plate} size="sm" />
                </PlateMorph>
              ) : (
                <Plate plate={h.item.plate} size="sm" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{h.item.makeModel ?? "Modelo não informado"}</div>
                <div className="truncate text-[13px] text-muted">{matchHint(h) ?? h.item.group}</div>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                {h.item.needsReview && <Badge tone="warn">Revisar placa</Badge>}
                {h.item.archived && <Badge>Arquivado</Badge>}
                <LegacyStatus value={h.item.legacyStatus} />
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </li>
          ))}
        </ul>
      )}

      {query && items && hits.length === 0 && deferred === query && (
        <div className={cx("fade-in px-4 py-10 text-center", hero && "mt-3 rounded-2xl bg-surface ring-1 ring-line")}>
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-ink/[0.05] text-ink-2">
            <AlertIcon size={20} />
          </div>
          <p className="text-[16px] font-semibold">Nada encontrado para “{query.trim()}”</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Confira a digitação. A busca aceita placa antiga ou Mercosul, com ou sem hífen, RENAVAM e chassi.
          </p>
          {isAdmin && key.length >= 5 && (
            <ButtonLink href={`/veiculos/novo?placa=${encodeURIComponent(key.slice(0, 10))}`} onClick={onNavigate} className="mt-5" variant="accent">
              <PlusIcon size={18} /> Cadastrar veículo {key.slice(0, 10)}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}

/** Ctrl/Cmd+K (ou "/") abre a busca em qualquer tela. O índice é carregado sob demanda e não é cacheado. */
export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setError(false);
      fetch("/api/search-index", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => setItems(j.items))
        .catch(() => setError(true));
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("frota:search", show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("frota:search", show);
    };
  }, []);

  return (
    <DialogShell open={open} onClose={() => setOpen(false)} label="Buscar veículo" className="md:!mb-auto md:!mt-[12vh]">
      <div className="min-h-[55dvh] pb-[var(--safe-bottom)] md:min-h-0">
        <SearchPanel
          items={items}
          isAdmin={isAdmin}
          autoFocus
          variant="palette"
          onNavigate={() => setOpen(false)}
          emptyContent={
            <p className="px-4 py-5 text-sm text-muted">
              {error ? "Não foi possível carregar a busca. Verifique a conexão." : "Digite ou cole a placa. Enter abre o primeiro resultado."}
            </p>
          }
        />
      </div>
    </DialogShell>
  );
}
