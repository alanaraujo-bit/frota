"use client";

import { useState } from "react";
import { CheckIcon } from "./icons";

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // área de transferência indisponível (ex.: HTTP fora de localhost): o valor segue selecionável.
        }
      }}
      aria-label={`Copiar ${label}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md text-left font-mono text-[15px] tabular tracking-tight hover:text-accent"
    >
      <span className="break-all">{value}</span>
      <span className="shrink-0 text-[11px] font-sans font-medium text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        {copied ? <CheckIcon size={14} className="text-ok" /> : "copiar"}
      </span>
    </button>
  );
}
