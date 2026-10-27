import { ShieldIcon } from "@/components/icons";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<ShieldIcon size={22} />} title="Acesso restrito" action={<ButtonLink href="/">Voltar para a busca</ButtonLink>}>
        Esta área é só para administradores. Se precisar, peça acesso a quem gerencia o sistema.
      </EmptyState>
    </main>
  );
}
