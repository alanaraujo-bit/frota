"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DOCUMENT_TYPES, documentTypeLabel, formatBytes } from "@/lib/files";
import { prepareFile, uploadDocument, validateFile } from "@/lib/upload-client";
import { CameraIcon, DownloadIcon, ExternalIcon, FileIcon, ImageIcon, PlusIcon, RefreshIcon, TrashIcon, UploadIcon, XIcon } from "./icons";
import { DialogShell, useSheetClose } from "./sheet";
import { toast } from "./toast";
import { Badge, Button, Field, Input, cx } from "./ui";

export type DocItem = {
  id: string;
  type: string;
  title: string;
  documentDate: string | null;
  mime: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function DocGlyph({ mime, className }: { mime: string; className?: string }) {
  const pdf = mime === "application/pdf";
  return (
    <span className={cx("grid size-11 shrink-0 place-items-center rounded-xl", pdf ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent", className)}>
      {pdf ? <FileIcon size={20} /> : <ImageIcon size={20} />}
    </span>
  );
}

/* ---------- Envio ---------- */

type Target = { replace?: DocItem };

function UploadSheet(props: { vehicleId: string; open: boolean; initialFile: File | null; target: Target; onClose: () => void }) {
  const abort = useRef<AbortController | null>(null);
  const close = () => {
    abort.current?.abort();
    props.onClose();
  };
  return (
    <DialogShell open={props.open} onClose={close} label={props.target.replace ? "Substituir documento" : "Adicionar documento"}>
      <UploadForm {...props} onClose={close} abort={abort} />
    </DialogShell>
  );
}

function UploadForm({
  vehicleId,
  initialFile,
  target,
  onClose,
  abort,
}: {
  vehicleId: string;
  initialFile: File | null;
  target: Target;
  onClose: () => void;
  abort: React.RefObject<AbortController | null>;
}) {
  const router = useRouter();
  const close = useSheetClose(onClose);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<string>(target.replace?.type ?? "");
  const [title, setTitle] = useState(target.replace?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(!!target.replace);
  const [date, setDate] = useState(target.replace?.documentDate?.slice(0, 10) ?? "");
  const [phase, setPhase] = useState<"idle" | "sending" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFile) void pick(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function pick(f: File | null | undefined) {
    if (!f) {
      setFile(null);
      setPreview(null);
      setError(null);
      return;
    }
    const problem = await validateFile(f);
    setError(null);
    if (problem) {
      setFile(null);
      setPreview(null);
      return setError(problem);
    }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function chooseType(t: string) {
    setType(t);
    if (!titleTouched) setTitle(documentTypeLabel(t) + (date ? ` ${date.slice(0, 4)}` : ""));
  }

  async function send() {
    if (!file) return setError("Escolha a foto ou o arquivo.");
    if (!type) return setError("Diga que documento é este.");
    if (!title.trim()) return setError("Dê um nome ao documento.");
    setError(null);
    setPhase("sending");
    setProgress(0);
    abort.current = new AbortController();
    try {
      const prepared = await prepareFile(file);
      await uploadDocument(vehicleId, prepared, { type, title: title.trim(), date: date || null, replacesId: target.replace?.id ?? null }, setProgress, abort.current.signal);
      setPhase("done");
      router.refresh();
      setTimeout(() => {
        toast(target.replace ? "Documento substituído" : "Documento salvo");
        close();
      }, 900);
    } catch (e) {
      setPhase("idle");
      if (!abort.current.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    }
  }

  const pct = Math.round(progress * 100);
  return (
    <>
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--safe-bottom))] pt-1 md:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="up-title" className="text-[19px] font-semibold tracking-tight">
            {target.replace ? "Substituir documento" : "Adicionar documento"}
          </h2>
          <button type="button" onClick={close} aria-label="Fechar" className="-m-2 grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.05]">
            <XIcon size={20} />
          </button>
        </div>

        {phase === "done" ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="pop grid size-16 place-items-center rounded-full bg-ok text-on-solid">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="check-draw">
                <path d="m5 12 5 5 9-10" />
              </svg>
            </span>
            <p className="mt-4 text-[17px] font-semibold">Pronto!</p>
            <p className="text-sm text-muted">Documento guardado com segurança.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />

            {file ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <DocGlyph mime={file.type || "application/pdf"} className="size-14" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{file.name}</p>
                  <p className="text-xs text-muted">{formatBytes(file.size)}</p>
                </div>
                {phase === "idle" && (
                  <Button variant="ghost" size="sm" onClick={() => pick(null)}>
                    Trocar
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-ink px-3 py-5 text-on-solid transition active:scale-[0.98]"
                >
                  <CameraIcon size={26} />
                  <span className="text-[14px] font-medium">Tirar foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-3 py-5 ring-1 ring-line-strong transition hover:ring-ink/30 active:scale-[0.98]"
                >
                  <UploadIcon size={26} />
                  <span className="text-[14px] font-medium">Escolher arquivo</span>
                </button>
                <p className="col-span-2 text-center text-xs text-muted">PDF, JPG, PNG ou WEBP · até 25 MB</p>
              </div>
            )}

            <fieldset disabled={phase !== "idle"} className="space-y-5">
              <div>
                <legend className="mb-2 text-[13px] font-medium text-ink-2">Que documento é este?</legend>
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tipo de documento">
                  {DOCUMENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={type === t.value}
                      onClick={() => chooseType(t.value)}
                      className={cx(
                        "h-11 rounded-xl text-[14px] font-medium ring-1 transition active:scale-[0.97]",
                        type === t.value ? "bg-accent text-on-solid ring-accent" : "bg-surface text-ink-2 ring-line-strong hover:ring-ink/30",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
                <Field label="Nome" htmlFor="doc-title">
                  <Input
                    id="doc-title"
                    value={title}
                    maxLength={120}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleTouched(true);
                    }}
                    placeholder="Ex.: CRLV 2026"
                  />
                </Field>
                <Field label="Data (opcional)" htmlFor="doc-date">
                  <Input id="doc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="fade-in rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
                {error}
              </p>
            )}

            {phase === "sending" ? (
              <div className="space-y-2" aria-live="polite">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Enviando com criptografia…</span>
                  <span className="tabular text-muted">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
                  Cancelar envio
                </Button>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={send}>
                {target.replace ? "Substituir documento" : "Salvar documento"}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Visualização ---------- */

function Viewer({ doc, onClose }: { doc: DocItem | null; onClose: () => void }) {
  return (
    <DialogShell open={!!doc} onClose={onClose} label={doc?.title ?? "Documento"} className="md:!w-[min(960px,calc(100%-48px))]">
      {doc && <ViewerBody key={doc.id} doc={doc} onClose={onClose} />}
    </DialogShell>
  );
}

function ViewerBody({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
  const close = useSheetClose(onClose);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${doc.id}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then((j) => setUrl(j.url))
      .catch((e) => setError(typeof e === "string" ? e : "Não foi possível abrir o documento."));
  }, [doc]);

  async function download() {
    const r = await fetch(`/api/documents/${doc.id}?download=1`, { cache: "no-store" });
    if (!r.ok) return toast("Não foi possível baixar.", "error");
    const { url: dl } = await r.json();
    const a = document.createElement("a");
    a.href = dl;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const isPdf = doc.mime === "application/pdf";
  return (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold">{doc.title}</p>
              <p className="text-xs text-muted">
                {documentTypeLabel(doc.type)} {doc.documentDate && `· ${fmtDate(doc.documentDate)}`} · {formatBytes(doc.size)}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={download}>
              <DownloadIcon size={16} /> <span className="hidden sm:inline">Baixar</span>
            </Button>
            <button type="button" onClick={close} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/[0.05]">
              <XIcon size={20} />
            </button>
          </div>
          <div className="min-h-[50dvh] flex-1 overflow-auto bg-surface-2 pb-[var(--safe-bottom)]">
            {error && <p className="p-8 text-center text-sm text-danger">{error}</p>}
            {!url && !error && <div className="skeleton m-6 h-[50dvh]" />}
            {url && !isPdf && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={doc.title} className="fade-in mx-auto max-h-[80dvh] w-auto max-w-full object-contain p-4" />
            )}
            {url && isPdf && (
              <>
                <iframe src={url} title={doc.title} className="hidden h-[75dvh] w-full md:block" />
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center md:hidden">
                  <DocGlyph mime={doc.mime} className="size-16" />
                  <p className="text-sm text-muted">No celular, o PDF abre no visualizador do aparelho.</p>
                  <a href={url} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 font-medium text-on-solid">
                    <ExternalIcon size={18} /> Abrir PDF
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
  );
}

/* ---------- Exclusão ---------- */

function ConfirmDelete({ doc, onClose }: { doc: DocItem | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run() {
    if (!doc) return;
    setPending(true);
    const r = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setPending(false);
    if (!r.ok) return toast((await r.json().catch(() => ({}))).error ?? "Não foi possível excluir.", "error");
    onClose();
    router.refresh();
    toast("Documento excluído");
  }
  return (
    <DialogShell open={!!doc} onClose={onClose} label="Excluir documento">
      {doc && (
        <div className="px-6 pb-[calc(24px+var(--safe-bottom))] pt-2 md:p-6">
          <h2 id="del-title" className="text-lg font-semibold">
            Excluir “{doc.title}”?
          </h2>
          <p className="mt-2 text-sm text-muted">O documento some da ficha. O administrador do sistema consegue recuperá-lo por até 30 dias.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <CancelButton onClose={onClose} />
            <Button variant="danger" onClick={run} disabled={pending}>
              {pending ? "Excluindo…" : "Excluir documento"}
            </Button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}

function CancelButton({ onClose }: { onClose: () => void }) {
  const close = useSheetClose(onClose);
  return (
    <Button variant="ghost" onClick={close}>
      Cancelar
    </Button>
  );
}

/* ---------- Painel ---------- */

export function DocumentsPanel({ vehicleId, docs, isAdmin }: { vehicleId: string; docs: DocItem[]; isAdmin: boolean }) {
  const [upload, setUpload] = useState<{ open: boolean; file: File | null; target: Target }>({ open: false, file: null, target: {} });
  const [viewing, setViewing] = useState<DocItem | null>(null);
  const [deleting, setDeleting] = useState<DocItem | null>(null);
  const [dragging, setDragging] = useState(false);

  const openUpload = (file: File | null = null, target: Target = {}) => setUpload({ open: true, file, target });

  const dropProps = isAdmin
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (e.dataTransfer.types.includes("Files")) setDragging(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        },
        onDragOver: (e: React.DragEvent) => e.dataTransfer.types.includes("Files") && e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) openUpload(f);
        },
      }
    : {};

  return (
    <section aria-labelledby="docs-title" className="relative" {...dropProps}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="docs-title" className="text-[17px] font-semibold tracking-tight">
          Documentos <span className="tabular font-normal text-muted">{docs.length > 0 && `· ${docs.length}`}</span>
        </h2>
        {isAdmin && docs.length > 0 && (
          <Button size="sm" onClick={() => openUpload()}>
            <PlusIcon size={16} /> Adicionar
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        isAdmin ? (
          <button
            type="button"
            onClick={() => openUpload()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center transition hover:border-accent hover:bg-accent-soft/30"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-ink text-on-solid">
              <CameraIcon size={22} />
            </span>
            <span className="text-[15px] font-semibold">Guarde o primeiro documento</span>
            <span className="max-w-xs text-sm text-muted">Fotografe o CRLV, a vistoria ou o seguro. No computador, também dá para arrastar o arquivo aqui.</span>
          </button>
        ) : (
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-sm text-muted ring-1 ring-line">Nenhum documento anexado a este veículo.</p>
        )
      ) : (
        <ul className="stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 md:gap-4">
              <button type="button" onClick={() => setViewing(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left md:gap-4">
                <DocGlyph mime={d.mime} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{d.title}</span>
                    <Badge tone="accent" className="hidden sm:inline-flex">
                      {documentTypeLabel(d.type)}
                    </Badge>
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {d.documentDate ? `${fmtDate(d.documentDate)} · ` : ""}
                    {formatBytes(d.size)} · enviado em {fmtWhen(d.createdAt)}
                  </span>
                </span>
              </button>
              {isAdmin && (
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => openUpload(null, { replace: d })} aria-label={`Substituir ${d.title}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink">
                    <RefreshIcon size={18} />
                  </button>
                  <button type="button" onClick={() => setDeleting(d)} aria-label={`Excluir ${d.title}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger">
                    <TrashIcon size={18} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/80 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-accent">
            <UploadIcon size={22} /> Solte para adicionar
          </span>
        </div>
      )}

      {isAdmin && (
        <UploadSheet
          vehicleId={vehicleId}
          open={upload.open}
          initialFile={upload.file}
          target={upload.target}
          onClose={() => setUpload((u) => ({ ...u, open: false }))}
        />
      )}
      <Viewer doc={viewing} onClose={() => setViewing(null)} />
      {isAdmin && <ConfirmDelete doc={deleting} onClose={() => setDeleting(null)} />}
    </section>
  );
}

