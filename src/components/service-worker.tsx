"use client";

import { useEffect, useState } from "react";

/** Registra o service worker e oferece a atualização quando um deploy novo chega. */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloading = false;
    // Só recarrega quando um SW antigo é substituído (atualização pedida). Na primeira instalação,
    // clients.claim() também dispara controllerchange e recarregar apagaria o que a pessoa digita.
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
      const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
      document.addEventListener("visibilitychange", check);
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fade-in fixed inset-x-4 bottom-[calc(var(--tabbar-space)+8px)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-xl md:bottom-6"
    >
      <span className="flex-1">Nova versão disponível.</span>
      <button
        type="button"
        onClick={() => waiting.postMessage("SKIP_WAITING")}
        className="rounded-lg bg-white px-3 py-1.5 font-medium text-ink hover:bg-white/90"
      >
        Atualizar
      </button>
    </div>
  );
}
