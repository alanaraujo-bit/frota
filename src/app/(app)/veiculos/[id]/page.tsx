import { PlateMorph, Screen } from "@/components/screen";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyValue } from "@/components/copy-button";
import { DocumentsPanel, type DocItem } from "@/components/documents-panel";
import { AlertIcon, ChevronLeft, EditIcon, PhoneIcon } from "@/components/icons";
import { ArchiveButton } from "@/components/vehicle-actions";
import { Badge, ButtonLink, Card, LegacyStatus, Plate } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { plateConflicts, type Alert, type Contact } from "@/lib/data";
import { db } from "@/lib/db";
import { documentTypeLabel } from "@/lib/files";
import { displayPlate } from "@/lib/plate";

export async function generateMetadata({ params }: PageProps<"/veiculos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const v = await db.vehicle.findUnique({ where: { id }, select: { plate: true } }).catch(() => null);
  return { title: v ? displayPlate(v.plate) : "Veículo" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4 xl:grid-cols-[150px_1fr] xl:[&:nth-last-child(2):nth-child(odd)]:border-0">
      <dt className="text-[13px] text-muted">
        {label}
        {hint && <span className="block text-[11px] leading-snug text-muted/80">{hint}</span>}
      </dt>
      <dd className="min-w-0 text-[15px]">{children ?? <span className="text-muted">—</span>}</dd>
    </div>
  );
}

const PHONE = /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/;

export default async function VehiclePage({ params }: PageProps<"/veiculos/[id]">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true, document: true, documentType: true } },
      documents: {
        where: { status: "PRONTO", deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!v || (v.archivedAt && !isAdmin)) notFound();

  await db.vehicleView.upsert({
    where: { userId_vehicleId: { userId: user.id, vehicleId: v.id } },
    create: { userId: user.id, vehicleId: v.id },
    update: { viewedAt: new Date() },
  });

  const conflicts = await plateConflicts(v.plateKey, v.id);
  const contacts = (v.contacts as Contact[]) ?? [];
  const alerts = (v.alerts as Alert[]) ?? [];
  const raw = v.sourceRaw as { aba: string; linha: number; celulas: Record<string, string> } | null;
  const docs: DocItem[] = v.documents.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    documentDate: d.documentDate?.toISOString() ?? null,
    mime: d.mime,
    size: d.size,
    createdAt: d.createdAt.toISOString(),
    uploadedBy: d.uploadedBy.name,
  }));
  const last = v.documents[0];

  return (
    <Screen>
      <Link href="/veiculos" transitionTypes={["nav-back"]} className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft size={16} /> Veículos
      </Link>

      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 [perspective:600px]">
          <PlateMorph id={v.id}>
            <div className="plate-in inline-block">
              <Plate plate={v.plate} size="xl" />
            </div>
          </PlateMorph>
          <h1 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">{v.makeModel ?? "Modelo não informado"}</h1>
          <p className="mt-1 text-[15px] text-muted">
            <Link href={`/veiculos?grupo=${v.group.id}`} className="font-medium text-ink-2 underline-offset-4 hover:underline">
              {v.group.name}
            </Link>
            {[v.year, v.color].filter(Boolean).length > 0 && <> · {[v.year, v.color].filter(Boolean).join(" · ")}</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {v.legacyStatus && <LegacyStatus value={v.legacyStatus} />}
            {v.plateNeedsReview && <Badge tone="warn">Placa para revisar</Badge>}
            {v.archivedAt && <Badge>Arquivado</Badge>}
            <Badge tone={docs.length ? "accent" : "neutral"}>
              {docs.length ? `${docs.length} documento${docs.length > 1 ? "s" : ""}` : "Sem documentos"}
            </Badge>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <ButtonLink href={`/veiculos/${v.id}/editar`} transitionTypes={["nav-forward"]} variant="secondary">
              <EditIcon size={18} /> Editar
            </ButtonLink>
            <ArchiveButton id={v.id} archived={!!v.archivedAt} plate={displayPlate(v.plate)} />
          </div>
        )}
      </header>

      {(alerts.length > 0 || conflicts.length > 0) && (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <div key={a.codigo} className="flex gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
              <AlertIcon size={18} className="mt-0.5 shrink-0" />
              <span>{a.mensagem}</span>
            </div>
          ))}
          {conflicts.length > 0 && (
            <div className="flex gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
              <AlertIcon size={18} className="mt-0.5 shrink-0" />
              <span>
                Mesma placa em outro cadastro:{" "}
                {conflicts.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/veiculos/${c.id}`} className="font-semibold underline underline-offset-2">
                      {displayPlate(c.plate)} ({c.group.name}
                      {c.archivedAt ? ", arquivado" : ""})
                    </Link>
                  </span>
                ))}
                . Nada foi fundido; confira qual registro está correto.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <DocumentsPanel vehicleId={v.id} docs={docs} isAdmin={isAdmin} />

          <Card className="px-5 py-2 md:px-6">
            <h2 className="sr-only">Dados do veículo</h2>
            <dl className="grid xl:grid-cols-2 xl:gap-x-10">
              <Row label="RENAVAM">{v.renavam ? <CopyValue value={v.renavam} label="RENAVAM" /> : null}</Row>
              <Row label="Chassi">{v.chassis ? <CopyValue value={v.chassis} label="chassi" /> : null}</Row>
              <Row label="Marca/modelo">{v.makeModel}</Row>
              <Row label="Ano">{v.year}</Row>
              <Row label="Cor">{v.color}</Row>
              <Row label="Referência da planilha" hint="Campo DATA original. Não é vencimento.">
                {v.sheetReference}
              </Row>
              <Row label="Vistoria">{v.inspection}</Row>
              <Row label="Situação legada" hint="Copiada da planilha (EM DIAS).">
                {v.legacyStatus ? <LegacyStatus value={v.legacyStatus} /> : null}
              </Row>
              {v.sheetStatus && <Row label="Status (planilha)">{v.sheetStatus}</Row>}
            </dl>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-[13px] font-medium text-muted">Titular</h2>
            <p className="text-[16px] font-semibold">{v.group.name}</p>
            {v.group.document && (
              <p className="mt-1 font-mono text-sm tabular text-ink-2">
                {v.group.documentType} {v.group.document}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-[13px] font-medium text-muted">Responsáveis e contatos</h2>
            {contacts.length ? (
              <ul className="space-y-3">
                {contacts.map((c, i) => (
                  <li key={i}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{c.rotulo || "Contato"}</p>
                    {PHONE.test(c.valor.trim()) ? (
                      <a href={`tel:${c.valor.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent">
                        <PhoneIcon size={15} /> {c.valor}
                      </a>
                    ) : (
                      <p className="text-[15px]">{c.valor}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum responsável informado.</p>
            )}
          </Card>

          {v.notes && (
            <Card className="p-5">
              <h2 className="mb-2 text-[13px] font-medium text-muted">Observações</h2>
              <p className="whitespace-pre-wrap text-[15px]">{v.notes}</p>
            </Card>
          )}

          {last && (
            <p className="px-1 text-xs text-muted">
              Último documento: {last.title} ({documentTypeLabel(last.type)}), {last.createdAt.toLocaleDateString("pt-BR")}.
            </p>
          )}

          {raw && (
            <details className="group rounded-2xl px-1 text-sm">
              <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-ink">
                Origem: planilha, aba “{raw.aba.trim()}”, linha {raw.linha}
              </summary>
              <dl className="mt-2 grid grid-cols-[52px_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface p-3 font-mono text-xs ring-1 ring-line">
                {Object.entries(raw.celulas).map(([k, val]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-all">{val}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </aside>
      </div>
    </Screen>
  );
}
