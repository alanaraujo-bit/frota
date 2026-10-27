"use client";

import { useEffect, useState } from "react";
import { AlertIcon, CheckIcon } from "./icons";
import { cx } from "./ui";

type Toast = { id: number; text: string; tone: "ok" | "error" };

/** Feedback curto, de qualquer componente: toast("Documento salvo"). */
export function toast(text: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent("frota:toast", { detail: { text, tone } }));
  if (tone === "ok") navigator.vibrate?.(12);
  else navigator.vibrate?.([30, 40, 30]);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((s) => [...s.slice(-2), { id, text, tone }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), tone === "ok" ? 2600 : 5000);
    };
    window.addEventListener("frota:toast", on);
    return () => window.removeEventListener("frota:toast", on);
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-space)+8px)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="toast-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-ink py-2.5 pl-3 pr-4 text-[14px] font-medium text-on-solid shadow-[0_12px_32px_-8px_rgb(20_22_27/0.45)]"
        >
          <span className={cx("grid size-6 place-items-center rounded-full", t.tone === "ok" ? "bg-ok" : "bg-danger")}>
            {t.tone === "ok" ? <CheckIcon size={14} strokeWidth={2.5} /> : <AlertIcon size={14} strokeWidth={2.25} />}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
