import type { Metadata } from "next";
import { InviteForm } from "@/components/auth-forms";
import { ButtonLink } from "@/components/ui";
import { sha256 } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Definir senha", referrer: "no-referrer" };

export default async function InvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const invite =
    token.length <= 100
      ? await db.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { name: true, email: true, active: true } } } })
      : null;
  const valid = invite && !invite.usedAt && invite.expiresAt > new Date() && invite.user.active;

  if (!valid) {
    return (
      <div className="fade-in">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Link indisponível</h1>
        <p className="mb-8 mt-2 text-[15px] text-muted">
          Este link expirou ou já foi usado. Peça ao administrador um novo convite.
        </p>
        <ButtonLink href="/entrar" variant="secondary">
          Ir para o login
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="fade-in">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Olá, {invite.user.name.split(" ")[0]}</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">
        Defina sua senha para acessar com <strong className="font-medium text-ink">{invite.user.email}</strong>.
      </p>
      <InviteForm token={token} email={invite.user.email} />
    </div>
  );
}
