"use client";

import { useSyncExternalStore } from "react";
import { cx } from "./ui";

const OPTIONS = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "escuro", label: "Escuro" },
] as const;

type Theme = (typeof OPTIONS)[number]["value"];
const EVENT = "tema-alterado";

function read(): Theme {
  try {
    const t = localStorage.getItem("tema");
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function choose(t: Theme) {
  try {
    if (t === "sistema") localStorage.removeItem("tema");
    else localStorage.setItem("tema", t);
  } catch {}
  // aplicarTema vem do script inline do layout.
  (window as unknown as { aplicarTema?: (t: string) => void }).aplicarTema?.(t);
  window.dispatchEvent(new Event(EVENT));
}

export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, read, () => "sistema" as Theme);
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.05] p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          onClick={() => choose(o.value)}
          className={cx(
            "h-10 rounded-lg text-[14px] font-medium transition-colors",
            current === o.value ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
