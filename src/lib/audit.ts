import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Pick<typeof db, "auditLog">;

export function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  data?: Prisma.InputJsonValue,
  tx: Tx = db,
) {
  return tx.auditLog.create({ data: { userId, action, entity, entityId, data } });
}

/** Diferença campo a campo para o registro de auditoria. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { de: unknown; para: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(after[k] ?? null);
    if (a !== b) out[k] = { de: before[k] ?? null, para: after[k] ?? null };
  }
  return out as Prisma.InputJsonValue;
}
