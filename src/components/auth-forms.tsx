"use client";

import { useActionState, useTransition } from "react";
import { acceptInvite, changePassword, login, type FormState } from "@/app/actions/auth";
import { Button, Field, Input } from "./ui";

/** Envia a action sem o reset automático do React 19: o que a pessoa digitou fica no campo se der erro. */
function useKeepValues(action: (s: FormState, f: FormData) => Promise<FormState>) {
  const [state, run, pending] = useActionState(action, undefined);
  const [submitting, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => run(fd));
  };
  return [state, onSubmit, pending || submitting] as const;
}

function Message({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm font-medium text-ok">
        {state.ok}
      </p>
    );
  return null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, onSubmit, pending] = useKeepValues(login);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Message state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, onSubmit, pending] = useKeepValues(acceptInvite);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 10 caracteres. Uma frase longa é ótima.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
      </Field>
      <Field label="Confirme a senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Message state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Salvando…" : "Definir senha e entrar"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, onSubmit, pending] = useKeepValues(changePassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Senha atual" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nova senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Field label="Confirme" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
      </div>
      <Message state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
