"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setVehicleArchived } from "@/app/actions/vehicles";
import { ArchiveIcon, RefreshIcon } from "./icons";
import { DialogShell, useSheetClose } from "./sheet";
import { toast } from "./toast";
import { Button } from "./ui";

function ConfirmArchive({ id, plate, onClose }: { id: string; plate: string; onClose: () => void }) {
  const close = useSheetClose(onClose);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = () =>
    start(async () => {
      const r = await setVehicleArchived(id, true);
      if ("error" in r) return setError(r.error);
      close();
      toast("Veículo arquivado");
      router.refresh();
    });
  return (
    <div className="px-6 pb-[calc(24px+var(--safe-bottom))] pt-2 md:p-6">
      <h2 className="text-lg font-semibold">Arquivar {plate}?</h2>
      <p className="mt-2 text-sm text-muted">O veículo sai da busca e da lista. Dados, histórico e documentos ficam guardados e podem ser restaurados.</p>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button onClick={run} disabled={pending}>
          {pending ? "Arquivando…" : "Arquivar veículo"}
        </Button>
      </div>
    </div>
  );
}

/** Arquivar não apaga: o veículo sai da busca e da lista padrão, com histórico e documentos preservados. */
export function ArchiveButton({ id, archived, plate }: { id: string; archived: boolean; plate: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (archived)
    return (
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setVehicleArchived(id, false);
            if ("error" in r) return toast(r.error, "error");
            toast("Veículo restaurado");
            router.refresh();
          })
        }
      >
        <RefreshIcon size={18} /> {pending ? "Restaurando…" : "Restaurar"}
      </Button>
    );

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ArchiveIcon size={18} /> Arquivar
      </Button>
      <DialogShell open={open} onClose={() => setOpen(false)} label={`Arquivar ${plate}`}>
        <ConfirmArchive id={id} plate={plate} onClose={() => setOpen(false)} />
      </DialogShell>
    </>
  );
}
