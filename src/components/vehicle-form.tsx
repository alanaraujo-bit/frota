"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import type { VehicleFormState } from "@/app/actions/vehicles";
import { displayPlate, plateFormat, plateKey } from "@/lib/plate";
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, ButtonLink, Card, Field, Input, Select, Textarea, cx, inputClass } from "./ui";

export type VehicleFormValues = {
  plate: string;
  groupId: string;
  makeModel: string;
  renavam: string;
  chassis: string;
  year: string;
  color: string;
  sheetReference: string;
  inspection: string;
  legacyStatus: string;
  notes: string;
  contacts: { rotulo: string; valor: string }[];
};

type Action = (state: VehicleFormState, form: FormData) => Promise<VehicleFormState | { error: string }>;

function Section({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={cx("p-5 md:p-6", wide && "lg:col-span-2")}>
      <h2 className="mb-4 text-[15px] font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function VehicleForm({
  action,
  initial,
  groups,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  initial: VehicleFormValues;
  groups: { id: string; name: string }[];
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action as (s: VehicleFormState, f: FormData) => Promise<VehicleFormState>, undefined);
  const [pending, start] = useTransition();
  const [plate, setPlate] = useState(initial.plate);
  const [contacts, setContacts] = useState(initial.contacts.length ? initial.contacts : []);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};
  const fmt = plateFormat(plate);
  const key = plateKey(plate);

  const submit = (confirm?: string) => {
    const fd = new FormData(formRef.current!);
    fd.set("contacts", JSON.stringify(contacts));
    if (confirm) fd.set("confirmConflict", confirm);
    start(() => formAction(fd));
  };

  const inspectionOptions = ["", "SIM", "NÃO", "TRANSF"];
  if (initial.inspection && !inspectionOptions.includes(initial.inspection)) inspectionOptions.push(initial.inspection);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-5 lg:grid-cols-2"
      noValidate
    >
      <Section title="Identificação" wide>
        <Field label="Placa" htmlFor="plate" error={fe.plate}>
          <input
            id="plate"
            name="plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            required
            className={cx(inputClass, "h-14 font-mono text-[24px] font-bold tracking-[0.08em] md:text-[24px]")}
            placeholder="ABC1D23"
          />
          <p className={cx("mt-1.5 flex items-center gap-1.5 text-xs font-medium", key.length < 5 ? "text-muted" : fmt === "invalida" ? "text-warn" : "text-ok")}>
            {key.length < 5 ? (
              "Antiga (ABC-1234) ou Mercosul (ABC1D23). Espaços e hífens não importam."
            ) : fmt === "invalida" ? (
              <>
                <AlertIcon size={14} /> Fora do padrão. Vai ser salva assim e marcada para revisão.
              </>
            ) : (
              <>
                <CheckIcon size={14} /> {fmt === "mercosul" ? "Placa Mercosul" : "Placa no padrão antigo"} · {displayPlate(plate)}
              </>
            )}
          </p>
        </Field>
        <Field label="Grupo / titular" htmlFor="groupId" error={fe.groupId}>
          <Select id="groupId" name="groupId" defaultValue={initial.groupId} required>
            <option value="" disabled>
              Escolha…
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Veículo">
        <div className="sm:col-span-2">
          <Field label="Marca / modelo" htmlFor="makeModel" error={fe.makeModel}>
            <Input id="makeModel" name="makeModel" defaultValue={initial.makeModel} placeholder="Ex.: VW/POLO TRACK MA" maxLength={120} />
          </Field>
        </div>
        <Field label="RENAVAM" htmlFor="renavam" error={fe.renavam}>
          <Input id="renavam" name="renavam" defaultValue={initial.renavam} inputMode="numeric" className="font-mono" maxLength={11} />
        </Field>
        <Field label="Chassi" htmlFor="chassis" error={fe.chassis}>
          <Input id="chassis" name="chassis" defaultValue={initial.chassis} autoCapitalize="characters" className="font-mono uppercase" maxLength={17} />
        </Field>
        <Field label="Ano" htmlFor="year" error={fe.year}>
          <Input id="year" name="year" defaultValue={initial.year} placeholder="Ex.: 2024/2025" maxLength={20} />
        </Field>
        <Field label="Cor" htmlFor="color" error={fe.color}>
          <Input id="color" name="color" defaultValue={initial.color} maxLength={40} />
        </Field>
      </Section>

      <Section title="Situação">
        <Field label="Vistoria" htmlFor="inspection">
          <Select id="inspection" name="inspection" defaultValue={initial.inspection}>
            {inspectionOptions.map((o) => (
              <option key={o} value={o}>
                {o || "Não informada"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Situação legada" htmlFor="legacyStatus" hint="Rótulo herdado da planilha. Não é calculado.">
          <Select id="legacyStatus" name="legacyStatus" defaultValue={initial.legacyStatus}>
            <option value="">Sem situação</option>
            <option value="OK">OK</option>
            <option value="ATRASADO">ATRASADO</option>
            <option value="PENDENTE">PENDENTE</option>
          </Select>
        </Field>
        <Field label="Referência da planilha" htmlFor="sheetReference" hint="Texto livre (ex.: MAIO ou 07/08/2026). Não é vencimento." error={fe.sheetReference}>
          <Input id="sheetReference" name="sheetReference" defaultValue={initial.sheetReference} maxLength={40} />
        </Field>
      </Section>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Responsáveis e contatos</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setContacts((c) => [...c, { rotulo: "", valor: "" }])} disabled={contacts.length >= 20}>
            <PlusIcon size={16} /> Adicionar
          </Button>
        </div>
        {contacts.length === 0 && <p className="text-sm text-muted">Nenhum. Use “Adicionar” para incluir setor, pessoa ou telefone.</p>}
        <ul className="space-y-2">
          {contacts.map((c, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
              <input
                aria-label={`Rótulo do contato ${i + 1}`}
                value={c.rotulo}
                onChange={(e) => setContacts((all) => all.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))}
                placeholder="Responsável"
                maxLength={60}
                className={cx(inputClass, "h-11")}
              />
              <input
                aria-label={`Valor do contato ${i + 1}`}
                value={c.valor}
                onChange={(e) => setContacts((all) => all.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                placeholder="Nome ou (94) 99999-9999"
                maxLength={200}
                className={cx(inputClass, "h-11")}
              />
              <button
                type="button"
                onClick={() => setContacts((all) => all.filter((_, j) => j !== i))}
                aria-label={`Remover contato ${i + 1}`}
                className="grid size-11 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 md:p-6 lg:col-span-2">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={initial.notes} maxLength={4000} rows={3} />
        </Field>
      </Card>

      {state?.conflicts && (
        <div role="alert" className="fade-in rounded-2xl bg-warn-soft p-4 text-sm text-warn lg:col-span-2">
          <p className="flex items-center gap-2 font-semibold">
            <AlertIcon size={18} /> Já existe veículo com a placa {displayPlate(plate)}
          </p>
          <ul className="mt-2 space-y-1">
            {state.conflicts.map((c) => (
              <li key={c.id}>
                <Link href={`/veiculos/${c.id}`} target="_blank" className="font-medium underline underline-offset-2">
                  {displayPlate(c.plate)} · {c.group}
                  {c.archived ? " (arquivado)" : ""}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2">Nada será fundido ou apagado. Salve assim só se for mesmo outro registro.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => submit(key)} disabled={pending}>
            Salvar mesmo assim
          </Button>
        </div>
      )}
      {state?.error && (
        <p role="alert" className="fade-in rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger lg:col-span-2">
          {state.error}
        </p>
      )}

      <div className="glass sticky bottom-[calc(var(--tabbar-space)+4px)] z-20 flex gap-2 rounded-[22px] p-2 md:static md:mx-0 md:justify-end lg:col-span-2 md:rounded-none md:border-0 md:bg-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <ButtonLink href={cancelHref} transitionTypes={["nav-back"]} variant="ghost" className="flex-1 md:flex-none">
          Cancelar
        </ButtonLink>
        <Button type="submit" size="lg" className="flex-[2] md:flex-none" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
