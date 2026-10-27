"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, LayersIcon, ListIcon, SearchIcon, UserIcon, UsersIcon } from "./icons";
import { Logo } from "./logo";
import { cx } from "./ui";

type Item = { href: string; label: string; icon: typeof HomeIcon; admin?: boolean };

const DESKTOP: Item[] = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/veiculos", label: "Veículos", icon: ListIcon },
  { href: "/grupos", label: "Grupos", icon: LayersIcon, admin: true },
  { href: "/usuarios", label: "Usuários", icon: UsersIcon, admin: true },
];

const MOBILE: Item[] = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/veiculos", label: "Veículos", icon: ListIcon },
  { href: "/grupos", label: "Grupos", icon: LayersIcon, admin: true },
  { href: "/conta", label: "Conta", icon: UserIcon },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

const openSearch = () => {
  navigator.vibrate?.(8);
  window.dispatchEvent(new Event("frota:search"));
};

export function AppNav({ isAdmin, name }: { isAdmin: boolean; name: string }) {
  const path = usePathname();
  const desktop = DESKTOP.filter((i) => !i.admin || isAdmin);
  const mobile = MOBILE.filter((i) => !i.admin || isAdmin);
  const activeIndex = mobile.findIndex((i) => isActive(path, i.href));
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="glass-bar sticky top-0 z-30 border-b border-line/60 pl-[var(--safe-left)] pr-[var(--safe-right)] pt-[var(--safe-top)]">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-6 px-4 md:h-16 md:px-8 xl:px-12">
          <Link href="/" transitionTypes={["nav-tab"]} className="shrink-0 rounded-lg" aria-label="FROTA, início">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {desktop.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                transitionTypes={["nav-tab"]}
                aria-current={isActive(path, i.href) ? "page" : undefined}
                className={cx(
                  "rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                  isActive(path, i.href) ? "bg-ink/[0.06] text-ink" : "text-muted hover:text-ink",
                )}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 items-center gap-2 rounded-xl bg-surface pl-3 pr-2 text-sm text-muted ring-1 ring-line-strong transition hover:text-ink"
            >
              <SearchIcon size={16} /> Buscar
              <kbd className="ml-4 rounded-md border border-line px-1.5 text-xs">Ctrl K</kbd>
            </button>
            <Link
              href="/conta"
              transitionTypes={["nav-tab"]}
              aria-label="Minha conta"
              className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold tracking-wide text-white"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>

      {/* Celular: barra de abas flutuante em vidro + botão de busca, acima da barra de gestos do aparelho. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-end gap-2.5 px-[max(14px,var(--safe-left))] pb-[calc(10px+var(--safe-bottom))] md:hidden"
        style={{ paddingRight: "max(14px, var(--safe-right))" }}
      >
        <nav aria-label="Navegação inferior" className="glass relative h-[62px] flex-1 rounded-full p-1 transition-transform active:scale-[0.985]">
          <span
            aria-hidden="true"
            className={cx(
              "glass-bubble absolute inset-y-1 left-1 rounded-full transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
              activeIndex < 0 && "opacity-0",
            )}
            style={{
              width: `calc((100% - 8px) / ${mobile.length})`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            }}
          />
          <ul className="relative flex h-full">
            {mobile.map((i) => {
              const active = isActive(path, i.href);
              return (
                <li key={i.href} className="flex-1">
                  <Link
                    href={i.href}
                    transitionTypes={["nav-tab"]}
                    onClick={() => navigator.vibrate?.(6)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold tracking-tight transition-colors",
                      active ? "text-ink" : "text-ink-2/70",
                    )}
                  >
                    <i.icon size={22} strokeWidth={active ? 2.1 : 1.8} />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Buscar veículo"
          className="glass grid size-[62px] shrink-0 place-items-center rounded-full text-ink transition-transform active:scale-90"
        >
          <SearchIcon size={24} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
