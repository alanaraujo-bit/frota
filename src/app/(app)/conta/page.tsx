import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/auth-forms";
import { ChevronRight, ClockIcon, LayersIcon, LogoutIcon, PhoneDeviceIcon, UsersIcon } from "@/components/icons";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Minha conta" };

function NavRow({ href, icon: Icon, label }: { href: string; icon: typeof UsersIcon; label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2 active:bg-ink/[0.04]">
        <Icon size={20} className="text-ink-2" />
        <span className="flex-1 text-[15px] font-medium">{label}</span>
        <ChevronRight size={18} className="text-muted" />
      </Link>
    </li>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <Screen className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={user.name} eyebrow="Minha conta">
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted">
          {user.email}
          <Badge tone="accent">{isAdmin ? "Administrador" : "Somente leitura"}</Badge>
        </p>
      </PageHeader>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          <NavRow href="/instalar" icon={PhoneDeviceIcon} label="Instalar o app no celular" />
          {isAdmin && <NavRow href="/grupos" icon={LayersIcon} label="Grupos e titulares" />}
          {isAdmin && <NavRow href="/usuarios" icon={UsersIcon} label="Usuários e convites" />}
          {isAdmin && <NavRow href="/auditoria" icon={ClockIcon} label="Histórico de alterações" />}
        </ul>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Alterar senha</h2>
        <ChangePasswordForm />
      </Card>

      <form action={logout}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogoutIcon size={18} /> Sair
        </Button>
      </form>

      <p className="pt-4 text-center text-xs text-muted">FROTA · desenvolvido por Alga</p>
    </Screen>
  );
}
