import { ViewTransition } from "react";

const MOTION = { "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" };

/** Conteúdo de uma tela: desliza ao avançar/voltar e faz fade ao trocar de aba (View Transitions). */
export function Screen({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <ViewTransition enter={MOTION} exit={MOTION} default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}

/** Placa que "voa" entre a lista/busca e a ficha do mesmo veículo. */
export function PlateMorph({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={`plate-${id}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
