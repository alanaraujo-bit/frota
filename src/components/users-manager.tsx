"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteUser, inviteUser, regenerateLink, updateUser } from "@/app/actions/admin";
import { CheckIcon, PlusIcon, ShieldIcon } from "./icons";
import { Sheet } from "./sheet";
import { toast } from "./toast";
import { Badge, Button, Field, Input, Select } from "./ui";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "LEITURA";
  active: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
};

function LinkResult({ link, name }: { link: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Olá, ${name.split(" ")[0]}! Seu acesso ao FROTA: ${link}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="fade-in space-y-3">
      <p className="text-sm text-muted">Envie este link para a pessoa. Ele vale por 48 horas e só pode ser usado uma vez.</p>
      <div className="break-all rounded-xl bg-surface-2 p-3 font-mono text-xs ring-1 ring-line">{link}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => {});
            setCopied(true);
            toast("Link copiado");
          }}
        >
          {copied ? <CheckIcon size={18} /> : null} {copied ? "Copiado" : "Copiar link"}
        </Button>
        {canShare ? (
          <Button onClick={() => navigator.share({ title: "Acesso ao FROTA", text }).catch(() => {})}>Compartilhar</Button>
        ) : (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-4 text-[15px] font-medium text-on-solid"
          >
            Enviar pelo WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function UsersManager({ users, meId }: { users: UserRow[]; meId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ link: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [pending, start] = useTransition();

  const invite = (form: FormData) =>
    start(async () => {
      const r = await inviteUser(form);
      if (r.error) return setError(r.error);
      setResult({ link: r.link!, name: String(form.get("name")) });
      router.refresh();
    });

  const act = (fn: () => Promise<{ ok?: string; error?: string; link?: string }>, name?: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) return toast(r.error, "error");
      if (r.link && name) {
        setResult({ link: r.link, name });
        setOpen(true);
      } else toast(r.ok!);
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="accent"
          onClick={() => {
            setResult(null);
            setError(null);
            setOpen(true);
          }}
        >
          <PlusIcon size={18} /> Convidar pessoa
        </Button>
      </div>
      <ul className="stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:flex-nowrap md:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-sm font-semibold text-ink-2">
              {u.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
                {u.name} {u.id === meId && <span className="text-xs font-normal text-muted">(você)</span>}
              </p>
              <p className="truncate text-[13px] text-muted">{u.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!u.active ? <Badge tone="danger">Desativado</Badge> : !u.hasPassword ? <Badge tone="warn">Convite pendente</Badge> : null}
              {u.id === meId ? (
                <Badge tone="accent">
                  <ShieldIcon size={12} /> Administrador
                </Badge>
              ) : (
                <>
                  <Select
                    aria-label={`Papel de ${u.name}`}
                    value={u.role}
                    disabled={pending || !u.active}
                    onChange={(e) => act(() => updateUser(u.id, { role: e.target.value as UserRow["role"] }))}
                    className="h-9 w-40 text-sm"
                  >
                    <option value="LEITURA">Somente leitura</option>
                    <option value="ADMIN">Administrador</option>
                  </Select>
                  {u.active && (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(() => regenerateLink(u.id), u.name)}>
                      {u.hasPassword ? "Redefinir senha" : "Novo link"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(() => updateUser(u.id, { active: !u.active }))}>
                    {u.active ? "Desativar" : "Reativar"}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDeleting(u)} className="text-danger">
                    Excluir
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title={result ? "Link de acesso pronto" : "Convidar pessoa"}>
        {result ? (
          <LinkResult link={result.link} name={result.name} />
        ) : (
          <form action={invite} className="space-y-4">
            <Field label="Nome" htmlFor="u-name">
              <Input id="u-name" name="name" required maxLength={120} autoFocus autoComplete="off" />
            </Field>
            <Field label="E-mail" htmlFor="u-email">
              <Input id="u-email" name="email" type="email" inputMode="email" required autoComplete="off" />
            </Field>
            <Field label="Acesso" htmlFor="u-role" hint="Leitura: consulta fichas e documentos. Administrador: também cadastra, edita, anexa e convida.">
              <Select id="u-role" name="role" defaultValue="LEITURA">
                <option value="LEITURA">Somente leitura</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
            {error && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Criando…" : "Criar convite"}
            </Button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title={`Excluir ${deleting?.name ?? ""}?`}>
        <p className="text-sm text-muted">
          A conta de {deleting?.email} é apagada de vez, com sessões e links de acesso. Não dá para desfazer. Para só bloquear o acesso, use “Desativar”.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setDeleting(null)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              const id = deleting!.id;
              setDeleting(null);
              act(() => deleteUser(id));
            }}
          >
            {pending ? "Excluindo…" : "Excluir pessoa"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
