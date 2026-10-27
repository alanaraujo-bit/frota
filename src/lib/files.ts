// Regras de arquivo compartilhadas entre cliente e servidor.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Abaixo do limite de 4,5 MB de corpo das funções da Vercel. */
export const CHUNK_BYTES = 3 * 1024 * 1024;

export const ALLOWED_MIME = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedMime = keyof typeof ALLOWED_MIME;

export function isAllowedMime(m: string): m is AllowedMime {
  return m in ALLOWED_MIME;
}

/** Confere a assinatura binária real do arquivo (não confia na extensão nem no Content-Type). */
export function sniffMime(head: Uint8Array): AllowedMime | null {
  const b = (i: number) => head[i];
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2d) return "application/pdf";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a) return "image/png";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50)
    return "image/webp";
  return null;
}

export const DOCUMENT_TYPES = [
  { value: "CRLV", label: "CRLV" },
  { value: "VISTORIA", label: "Vistoria" },
  { value: "SEGURO", label: "Seguro" },
  { value: "OUTRO", label: "Outros" },
] as const;

export function documentTypeLabel(t: string) {
  return DOCUMENT_TYPES.find((d) => d.value === t)?.label ?? t;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Nome seguro para Content-Disposition. */
export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, "_").trim().slice(0, 120);
  return cleaned || "documento";
}
