import "server-only";
import { db } from "@/lib/db";
import type { SearchItem } from "@/lib/search";

export async function getSearchIndex(includeArchived: boolean): Promise<SearchItem[]> {
  const rows = await db.vehicle.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    select: {
      id: true,
      plate: true,
      renavam: true,
      chassis: true,
      makeModel: true,
      legacyStatus: true,
      archivedAt: true,
      plateNeedsReview: true,
      group: { select: { id: true, name: true } },
    },
    orderBy: { plate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    plate: r.plate,
    renavam: r.renavam,
    chassis: r.chassis,
    makeModel: r.makeModel,
    legacyStatus: r.legacyStatus,
    group: r.group.name,
    groupId: r.group.id,
    archived: !!r.archivedAt,
    needsReview: r.plateNeedsReview,
  }));
}

export async function getRecentVehicles(userId: string) {
  const views = await db.vehicleView.findMany({
    where: { userId, vehicle: { archivedAt: null } },
    orderBy: { viewedAt: "desc" },
    take: 8,
    select: {
      viewedAt: true,
      vehicle: { select: { id: true, plate: true, makeModel: true, group: { select: { name: true } } } },
    },
  });
  return views.map((v) => ({ ...v.vehicle, viewedAt: v.viewedAt }));
}

export async function getGroups(includeArchived = false) {
  return db.group.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { vehicles: { where: { archivedAt: null } } } } },
  });
}

export type Contact = { rotulo: string; valor: string };
export type Alert = { codigo: string; mensagem: string };

/** Outros veículos com a mesma placa normalizada (aviso, nunca bloqueio). */
export async function plateConflicts(plateKey: string, exceptId?: string) {
  if (!plateKey) return [];
  return db.vehicle.findMany({
    where: { plateKey, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, plate: true, archivedAt: true, group: { select: { name: true } } },
  });
}
