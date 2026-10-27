"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "./toast";

const MESSAGES: Record<string, string> = {
  criado: "Veículo cadastrado",
  salvo: "Alterações salvas",
};

/** Mostra o toast de confirmação depois de um redirect (?ok=...) e limpa a URL. */
export function Flash() {
  const params = useSearchParams();
  const pathname = usePathname();
  const ok = params.get("ok");
  useEffect(() => {
    if (!ok || !MESSAGES[ok]) return;
    toast(MESSAGES[ok]);
    const next = new URLSearchParams(params);
    next.delete("ok");
    // Sem navegação: um router.replace aqui atropelaria um toque logo em seguida (ex.: "Editar").
    window.history.replaceState(window.history.state, "", `${pathname}${next.size ? `?${next}` : ""}`);
  }, [ok, params, pathname]);
  return null;
}
