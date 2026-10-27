import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

const SECURE = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = SECURE ? "__Host-frota_session" : "frota_session";
const MAX_AGE_DAYS = 30;
const IDLE_DAYS = 7;
const DAY = 86_400_000;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * DAY);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; name: string; email: string; role: "ADMIN" | "LEITURA" };

/** Lê e valida a sessão (uma vez por requisição). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  const now = Date.now();
  if (!s || !s.user.active || s.expiresAt.getTime() < now || s.lastSeenAt.getTime() < now - IDLE_DAYS * DAY) {
    if (s) await db.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  if (s.lastSeenAt.getTime() < now - 3_600_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  const { id, name, email, role } = s.user;
  return { id, name, email, role };
});

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
