import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "@/components/users-manager";
import { requireAdmin } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <Screen className="mx-auto max-w-5xl">
      <PageHeader title="Usuários">
        <p className="mt-1.5 text-[15px] text-muted">
          Cadastro fechado: só entra quem recebe convite.{" "}
          <Link href="/auditoria" className="font-medium text-accent underline-offset-4 hover:underline">
            Ver histórico de alterações
          </Link>
        </p>
      </PageHeader>
      <UsersManager
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          hasPassword: !!u.passwordHash,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </Screen>
  );
}
