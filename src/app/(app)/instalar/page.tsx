import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import { InstallGuide } from "@/components/install-guide";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Instalar o app" };

export default function InstallPage() {
  return (
    <Screen className="mx-auto max-w-2xl">
      <PageHeader title="Instale o FROTA">
        <p className="mt-1.5 text-[15px] text-muted">Ícone na tela inicial, abertura em tela cheia e busca a um toque.</p>
      </PageHeader>
      <InstallGuide />
    </Screen>
  );
}
