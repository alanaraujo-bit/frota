import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Histórico" };

const ACTIONS: Record<string, string> = {
  create: "criou",
  update: "alterou",
  archive: "arquivou",
  restore: "restaurou",
  upload: "anexou documento em",
  replace: "substituiu documento em",
  delete: "excluiu documento de",
  invite: "convidou",
  invite_link: "gerou novo convite para",
  password_reset_link: "gerou link de redefinição para",
  set_password: "definiu a senha",
  change_password: "alterou a própria senha",
  login: "entrou",
  logout: "saiu",
  bootstrap_admin: "administrador inicial criado",
};
const ENTITIES: Record<string, string> = { vehicle: "veículo", group: "grupo", user: "usuário", document: "documento" };

export default async function AuditPage() {
  await requireAdmin();
  const logs = await db.auditLog.findMany({
    where: { action: { notIn: ["login", "logout"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const vehicleIds = new Set<string>();
  for (const l of logs) {
    if (l.entity === "vehicle" && l.entityId) vehicleIds.add(l.entityId);
    const v = (l.data as { veiculo?: string } | null)?.veiculo;
    if (v) vehicleIds.add(v);
  }
  const [users, vehicles] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.vehicle.findMany({ where: { id: { in: [...vehicleIds] } }, select: { id: true, plate: true } }),
  ]);
  const uName = new Map(users.map((u) => [u.id, u.name]));
  const plate = new Map(vehicles.map((v) => [v.id, v.plate]));

  return (
    <Screen className="mx-auto max-w-5xl">
      <PageHeader title="Histórico de alterações">
        <p className="mt-1.5 text-[15px] text-muted">Últimos 200 registros de cadastros, edições, documentos e acessos.</p>
      </PageHeader>
      {logs.length === 0 ? (
        <Card>
          <EmptyState title="Nada registrado ainda" />
        </Card>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {logs.map((l) => {
            const data = l.data as Record<string, unknown> | null;
            const vid = l.entity === "vehicle" ? l.entityId : (data?.veiculo as string | undefined);
            const changed = l.action === "update" && data ? Object.keys(data).filter((k) => k !== "plateKey" && k !== "plateNeedsReview") : [];
            return (
              <li key={l.id} className="px-5 py-3.5 text-[14px]">
                <p>
                  <strong className="font-semibold">{l.userId ? (uName.get(l.userId) ?? "Usuário removido") : "Sistema"}</strong>{" "}
                  {ACTIONS[l.action] ?? l.action}{" "}
                  {l.entity !== "document" && !["set_password", "change_password", "bootstrap_admin"].includes(l.action) && ENTITIES[l.entity]}{" "}
                  {vid && plate.get(vid) && (
                    <Link href={`/veiculos/${vid}`} className="font-mono font-semibold text-accent">
                      {plate.get(vid)}
                    </Link>
                  )}
                  {typeof data?.titulo === "string" && <> · “{data.titulo}”</>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {l.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {changed.length > 0 && ` · campos: ${changed.join(", ")}`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
