"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, getCurrentUser, sha256 } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type FormState = { error?: string; ok?: string } | undefined;

const WINDOW_MS = 15 * 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 30;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const next = String(form.get("next") ?? "/");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) {
    return { error: "Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  await db.loginAttempt.create({ data: { email, ip, success: valid && !!user?.active } });
  if (!valid || !user || !user.active) return { error: "E-mail ou senha incorretos." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit(user.id, "login", "user", user.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "logout", "user", user.id);
  redirect("/entrar");
}

const acceptSchema = z.object({ token: z.string().min(20).max(100), password: z.string(), confirm: z.string() });

export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Link inválido." };
  const { token, password, confirm } = parsed.data;
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || !invite.user.active) {
    return { error: "Este link expirou ou já foi usado. Peça um novo ao administrador." };
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: invite.userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: invite.userId } }),
  ]);
  await audit(invite.userId, "set_password", "user", invite.userId);
  await createSession(invite.userId);
  redirect("/");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { error: "Senha atual incorreta." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "As senhas não conferem." };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(user.id, "change_password", "user", user.id);
  await createSession(user.id);
  return { ok: "Senha alterada. Outras sessões foram encerradas." };
}
