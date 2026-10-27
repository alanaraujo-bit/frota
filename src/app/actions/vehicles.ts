"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, diff } from "@/lib/audit";
import { AuthError, assertUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { plateFormat, plateKey } from "@/lib/plate";

export type VehicleFormState =
  | { error?: string; fieldErrors?: Record<string, string>; conflicts?: { id: string; plate: string; group: string; archived: boolean }[] }
  | undefined;

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => plateKey(v).length >= 5 && plateKey(v).length <= 10, "Informe a placa (5 a 10 letras/dígitos)."),
  groupId: z.uuid("Escolha o grupo/titular."),
  makeModel: opt(120),
  renavam: opt(20).refine((v) => !v || /^\d{1,11}$/.test(v), "RENAVAM tem até 11 dígitos, só números."),
  chassis: opt(30)
    .transform((v) => (v ? v.toUpperCase().replace(/\s/g, "") : null))
    .refine((v) => !v || /^[A-Z0-9]{1,17}$/.test(v), "Chassi tem até 17 letras e números."),
  year: opt(20),
  color: opt(40),
  sheetReference: opt(40),
  inspection: opt(40),
  legacyStatus: opt(20),
  notes: opt(4000),
  contacts: z
    .string()
    .transform((s) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        return [];
      }
    })
    .pipe(
      z
        .array(z.object({ rotulo: z.string().trim().max(60), valor: z.string().trim().max(200) }))
        .max(20)
        .transform((a) => a.filter((c) => c.rotulo || c.valor)),
    ),
  confirmConflict: z.string().optional(),
});

function parse(form: FormData) {
  const raw = Object.fromEntries(form);
  const r = vehicleSchema.safeParse({ ...raw, contacts: raw.contacts ?? "[]" });
  if (!r.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of r.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: { error: "Revise os campos destacados.", fieldErrors } as VehicleFormState };
  }
  return { data: r.data };
}

async function conflictsFor(key: string, exceptId?: string) {
  const rows = await db.vehicle.findMany({
    where: { plateKey: key, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, plate: true, archivedAt: true, group: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, plate: r.plate, group: r.group.name, archived: !!r.archivedAt }));
}

function guard<T extends unknown[], R>(fn: (...a: T) => Promise<R>) {
  return async (...a: T): Promise<R | { error: string }> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof AuthError) return { error: e.message };
      throw e;
    }
  };
}

export const createVehicle = guard(async (_: VehicleFormState, form: FormData): Promise<VehicleFormState> => {
  const user = await assertUser(true);
  const p = parse(form);
  if (!p.data) return p.error;
  const { confirmConflict, ...d } = p.data;
  const key = plateKey(d.plate);
  const conflicts = await conflictsFor(key);
  if (conflicts.length && confirmConflict !== key) return { conflicts };
  if (!(await db.group.findFirst({ where: { id: d.groupId, archivedAt: null } }))) return { fieldErrors: { groupId: "Grupo inválido." } };

  const v = await db.vehicle.create({
    data: { ...d, plateKey: key, plateNeedsReview: plateFormat(d.plate) === "invalida" },
  });
  await audit(user.id, "create", "vehicle", v.id, { placa: v.plate, conflitos: conflicts.map((c) => c.id) });
  revalidatePath("/", "layout");
  redirect(`/veiculos/${v.id}?ok=criado`);
});

export const updateVehicle = guard(async (id: string, _: VehicleFormState, form: FormData): Promise<VehicleFormState> => {
  const user = await assertUser(true);
  const before = await db.vehicle.findUnique({ where: { id } });
  if (!before) return { error: "Veículo não encontrado." };
  const p = parse(form);
  if (!p.data) return p.error;
  const { confirmConflict, ...d } = p.data;
  const key = plateKey(d.plate);
  if (key !== before.plateKey) {
    const conflicts = await conflictsFor(key, id);
    if (conflicts.length && confirmConflict !== key) return { conflicts };
  }
  if (d.groupId !== before.groupId && !(await db.group.findFirst({ where: { id: d.groupId, archivedAt: null } }))) {
    return { fieldErrors: { groupId: "Grupo inválido." } };
  }
  const data = { ...d, plateKey: key, plateNeedsReview: plateFormat(d.plate) === "invalida" };
  const changes = diff(before as unknown as Record<string, unknown>, data);
  await db.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id }, data });
    await audit(user.id, "update", "vehicle", id, changes, tx);
  });
  revalidatePath("/", "layout");
  redirect(`/veiculos/${id}?ok=salvo`);
});

export const setVehicleArchived = guard(async (id: string, archived: boolean) => {
  const user = await assertUser(true);
  await db.vehicle.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(user.id, archived ? "archive" : "restore", "vehicle", id);
  revalidatePath("/", "layout");
  return { ok: true as const };
});
