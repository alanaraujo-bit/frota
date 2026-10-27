import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

/** Páginas: exige sessão válida. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Páginas: exige papel de administrador. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") forbidden();
  return user;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Sessão expirada. Entre novamente." : "Sem permissão para esta ação.");
  }
}

/** Server Actions e rotas de API: lança AuthError em vez de redirecionar. */
export async function assertUser(admin = false): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401);
  if (admin && user.role !== "ADMIN") throw new AuthError(403);
  return user;
}
