"use client";

import { AlertIcon, RefreshIcon } from "@/components/icons";
import { Button, EmptyState } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4">
      <EmptyState
        icon={<AlertIcon size={22} />}
        title="Algo não saiu como esperado"
        action={
          <Button onClick={reset}>
            <RefreshIcon size={18} /> Tentar de novo
          </Button>
        }
      >
        Verifique a conexão e tente outra vez. Se continuar, avise o administrador.
      </EmptyState>
    </main>
  );
}
