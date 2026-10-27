"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, diff } from "@/lib/audit";
import { AuthError, assertUser } from "@/lib/auth/dal";
import { createInviteLink } from "@/lib/auth/invite";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Result = { ok?: string; error?: string; link?: string };

async function run(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
}

const groupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do grupo/titular.").max(120),
  document: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v || null)
    .refine((v) => !v || /^[\d./-]+$/.test(v), "Use só números, pontos, barra e hífen."),
});

function docType(doc: string | null) {
  if (!doc) return null;
  const n = doc.replace(/\D/g, "").length;
  return n === 14 ? "CNPJ" : n === 11 ? "CPF" : null;
}

export async function saveGroup(id: string | null, form: FormData): Promise<Result> {
  return run(async () => {
    const user = await assertUser(true);
    const r = groupSchema.safeParse(Object.fromEntries(form));
    if (!r.success) return { error: r.error.issues[0].message };
    const data = { ...r.data, documentType: docType(r.data.document) };
    if (id) {
      const before = await db.group.findUnique({ where: { id } });
      if (!before) return { error: "Grupo não encontrado." };
      await db.group.update({ where: { id }, data });
      await audit(user.id, "update", "group", id, diff(before as unknown as Record<string, unknown>, data));
    } else {
      const max = await db.group.aggregate({ _max: { sortOrder: true } });
      const g = await db.group.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit(user.id, "create", "group", g.id, { nome: g.name });
    }
    revalidatePath("/", "layout");
    return { ok: id ? "Grupo atualizado" : "Grupo criado" };
  });
}

export async function setGroupArchived(id: string, archived: boolean): Promise<Result> {
  return run(async () => {
    const user = await assertUser(true);
    if (archived) {
      const active = await db.vehicle.count({ where: { groupId: id, archivedAt: null } });
      if (active > 0) return { error: `Este grupo ainda tem ${active} veículo(s) ativo(s). Mova ou arquive os veículos antes.` };
    }
    await db.group.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(user.id, archived ? "archive" : "restore", "group", id);
    revalidatePath("/", "layout");
    return { ok: archived ? "Grupo arquivado" : "Grupo restaurado" };
  });
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.email("E-mail inválido.").transform((v) => v.trim().toLowerCase()),
  role: z.enum(["ADMIN", "LEITURA"]),
});

export async function inviteUser(form: FormData): Promise<Result> {
  return run(async () => {
    const admin = await assertUser(true);
    const r = inviteSchema.safeParse(Object.fromEntries(form));
    if (!r.success) return { error: r.error.issues[0].message };
    const exists = await db.user.findUnique({ where: { email: r.data.email } });
    if (exists) return { error: "Já existe uma conta com este e-mail. Use “Gerar link” na lista." };
    const user = await db.user.create({ data: r.data });
    const link = await createInviteLink(db, env().APP_URL, user.id, admin.id);
    await audit(admin.id, "invite", "user", user.id, { email: user.email, papel: user.role });
    revalidatePath("/usuarios");
    return { ok: "Convite criado", link: link.url };
  });
}

export async function regenerateLink(userId: string): Promise<Result> {
  return run(async () => {
    const admin = await assertUser(true);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) return { error: "Usuário inativo ou inexistente." };
    const link = await createInviteLink(db, env().APP_URL, user.id, admin.id);
    await audit(admin.id, user.passwordHash ? "password_reset_link" : "invite_link", "user", user.id);
    return { ok: "Link gerado", link: link.url };
  });
}

export async function updateUser(userId: string, patch: { role?: "ADMIN" | "LEITURA"; active?: boolean }): Promise<Result> {
  return run(async () => {
    const admin = await assertUser(true);
    if (userId === admin.id) return { error: "Você não pode alterar o próprio acesso." };
    const before = await db.user.findUnique({ where: { id: userId } });
    if (!before) return { error: "Usuário não encontrado." };
    const data = z.object({ role: z.enum(["ADMIN", "LEITURA"]).optional(), active: z.boolean().optional() }).parse(patch);
    await db.$transaction([
      db.user.update({ where: { id: userId }, data }),
      ...(data.active === false || data.role ? [db.session.deleteMany({ where: { userId } })] : []),
    ]);
    await audit(admin.id, "update", "user", userId, diff({ role: before.role, active: before.active }, data));
    revalidatePath("/usuarios");
    return { ok: data.active === false ? "Acesso desativado" : data.active ? "Acesso reativado" : "Papel alterado" };
  });
}
