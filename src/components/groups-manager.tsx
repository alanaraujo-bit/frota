"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGroup, setGroupArchived } from "@/app/actions/admin";
import { ArchiveIcon, ChevronRight, EditIcon, PlusIcon, RefreshIcon } from "./icons";
import { Sheet } from "./sheet";
import { toast } from "./toast";
import { Badge, Button, Field, Input } from "./ui";

export type GroupRow = { id: string; name: string; document: string | null; documentType: string | null; count: number; archived: boolean; imported: boolean };

export function GroupsManager({ groups }: { groups: GroupRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GroupRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = editing && editing !== "new" ? editing : null;

  const submit = (form: FormData) =>
    start(async () => {
      const r = await saveGroup(current?.id ?? null, form);
      if (r.error) return setError(r.error);
      setEditing(null);
      toast(r.ok!);
      router.refresh();
    });

  const archive = (g: GroupRow) =>
    start(async () => {
      const r = await setGroupArchived(g.id, !g.archived);
      if (r.error) return toast(r.error, "error");
      toast(r.ok!);
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="accent"
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
        >
          <PlusIcon size={18} /> Novo grupo
        </Button>
      </div>
      <ul className="stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
            <Link href={`/veiculos?grupo=${g.id}`} className="group min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold group-hover:text-accent">{g.name}</span>
                {g.archived && <Badge>Arquivado</Badge>}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {g.document ? `${g.documentType ?? "Doc."} ${g.document} · ` : ""}
                <span className="tabular">{g.count}</span> veículo{g.count === 1 ? "" : "s"}
                {g.imported && " · importado da planilha"}
              </span>
            </Link>
            <button
              type="button"
              aria-label={`Editar ${g.name}`}
              onClick={() => {
                setError(null);
                setEditing(g);
              }}
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
            >
              <EditIcon size={18} />
            </button>
            <button
              type="button"
              aria-label={g.archived ? `Restaurar ${g.name}` : `Arquivar ${g.name}`}
              disabled={pending}
              onClick={() => archive(g)}
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
            >
              {g.archived ? <RefreshIcon size={18} /> : <ArchiveIcon size={18} />}
            </button>
            <ChevronRight size={18} className="hidden text-muted md:block" />
          </li>
        ))}
      </ul>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={current ? "Editar grupo" : "Novo grupo"}>
        <form action={submit} className="space-y-4">
          <Field label="Nome do grupo / titular" htmlFor="g-name">
            <Input id="g-name" name="name" defaultValue={current?.name} required maxLength={120} autoFocus />
          </Field>
          <Field label="CNPJ ou CPF (opcional)" htmlFor="g-doc" hint="Dado privado: visível só para usuários do sistema.">
            <Input id="g-doc" name="document" defaultValue={current?.document ?? ""} inputMode="numeric" maxLength={20} className="font-mono" />
          </Field>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : current ? "Salvar" : "Criar grupo"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
