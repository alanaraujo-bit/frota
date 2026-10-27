"use client";

import { createContext, use, useEffect, useRef } from "react";
import { XIcon } from "./icons";
import { cx } from "./ui";

const CloseContext = createContext<(() => void) | null>(null);

/** Fecha a folha com animação (dentro de um DialogShell); fora dele, chama o fallback direto. */
export function useSheetClose(fallback: () => void) {
  return use(CloseContext) ?? fallback;
}

/**
 * Base acessível em <dialog>: folha inferior no celular (com alça, arrastar para baixo fecha),
 * modal no desktop. Fecha com animação; o conteúdo só monta quando aberto.
 */
export function DialogShell({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      delete d.dataset.closing;
      d.style.transform = "";
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const requestClose = () => {
    const d = ref.current;
    if (!d || d.dataset.closing) return;
    d.dataset.closing = "1";
    navigator.vibrate?.(6);
    setTimeout(onClose, 190);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ref.current!.style.transition = "none";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    ref.current!.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const d = ref.current!;
    const velocity = g.dy / Math.max(1, performance.now() - g.t);
    if (g.dy > 110 || velocity > 0.6) return requestClose();
    d.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
    d.style.transform = "";
  };

  return (
    <dialog
      ref={ref}
      className={cx("sheet", className)}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      {open && (
        <CloseContext value={requestClose}>
          <div
            className="flex h-6 touch-none items-center justify-center md:hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden="true"
          >
            <span className="h-[5px] w-10 rounded-full bg-ink/20" />
          </div>
          {children}
        </CloseContext>
      )}
    </dialog>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const close = useSheetClose(onClose);
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
      <button type="button" onClick={close} aria-label="Fechar" className="-m-2 grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.05]">
        <XIcon size={20} />
      </button>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <DialogShell open={open} onClose={onClose} label={title}>
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--safe-bottom))] pt-1 md:p-7">
        <SheetHeader title={title} onClose={onClose} />
        {children}
      </div>
    </DialogShell>
  );
}
