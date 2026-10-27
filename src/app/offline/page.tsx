import type { Metadata } from "next";
import { RetryButton } from "@/components/retry-button";
import { WifiOffIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[var(--safe-bottom)] pt-[var(--safe-top)] text-center">
      <Logo />
      <span className="mt-12 grid size-16 place-items-center rounded-3xl bg-ink/[0.06] text-ink-2">
        <WifiOffIcon size={30} />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight">Sem conexão</h1>
      <p className="mt-2 max-w-xs text-[15px] text-muted">
        Para proteger os dados da frota, nada fica salvo no aparelho. Assim que a internet voltar, é só tentar de novo.
      </p>
      <RetryButton />
    </main>
  );
}
