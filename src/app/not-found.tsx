import { SearchIcon } from "@/components/icons";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<SearchIcon size={22} />} title="Não encontramos esta página" action={<ButtonLink href="/">Voltar para a busca</ButtonLink>}>
        O endereço pode estar incompleto, ou o veículo foi arquivado.
      </EmptyState>
    </main>
  );
}
