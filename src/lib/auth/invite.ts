import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

const INVITE_HOURS = 48;

/** Cria link de uso único para definir senha (convite, bootstrap ou redefinição). Invalida links anteriores. */
export async function createInviteLink(
  db: Pick<PrismaClient, "invite">,
  appUrl: string,
  userId: string,
  createdById: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  await db.invite.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await db.invite.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      createdById,
      expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000),
    },
  });
  return { url: `${appUrl.replace(/\/$/, "")}/convite/${token}`, hours: INVITE_HOURS };
}
