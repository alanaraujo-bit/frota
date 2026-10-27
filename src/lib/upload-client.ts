// Envio em blocos com progresso real (XHR), nova tentativa por bloco e cancelamento.
import { isAllowedMime, MAX_FILE_BYTES, sniffMime } from "./files";

export type UploadMeta = { type: string; title: string; date: string | null; replacesId?: string | null };

export class UploadError extends Error {}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new UploadError(body.error ?? `Falha (${r.status}).`);
  return body as T;
}

function putChunk(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Falha no envio (${xhr.status}).`;
      try {
        msg = JSON.parse(xhr.responseText).error ?? msg;
      } catch {}
      reject(Object.assign(new UploadError(msg), { status: xhr.status }));
    };
    xhr.onerror = () => reject(Object.assign(new UploadError("Conexão interrompida."), { status: 0 }));
    signal.addEventListener("abort", () => xhr.abort());
    xhr.onabort = () => reject(new UploadError("Envio cancelado."));
    xhr.send(blob);
  });
}

/** Fotos: reduz para no máx. 2560 px e regrava em JPEG (também remove EXIF/GPS). PDFs passam intactos. */
export async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob) return file;
    if (isAllowedMime(file.type) && blob.size >= file.size && scale === 1) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function validateFile(file: File): Promise<string | null> {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_FILE_BYTES) return "Arquivo acima de 25 MB.";
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const real = sniffMime(head);
  if (!real) return "Formato não aceito. Envie PDF, JPG, PNG ou WEBP.";
  return null;
}

export async function uploadDocument(
  vehicleId: string,
  file: File,
  meta: UploadMeta,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMime(head);
  if (!mime) throw new UploadError("Formato não aceito. Envie PDF, JPG, PNG ou WEBP.");
  const init = await api<{ id: string; chunkSize: number; chunkCount: number }>(`/api/vehicles/${vehicleId}/documents`, {
    method: "POST",
    body: JSON.stringify({ ...meta, fileName: file.name.slice(0, 200), mime, size: file.size }),
  });
  try {
    for (let i = 0; i < init.chunkCount; i++) {
      const start = i * init.chunkSize;
      const blob = file.slice(start, Math.min(file.size, start + init.chunkSize));
      for (let attempt = 0; ; attempt++) {
        try {
          await putChunk(`/api/documents/${init.id}/chunks/${i}`, blob, (l) => onProgress(Math.min(0.99, (start + l) / file.size)), signal);
          break;
        } catch (e) {
          const status = (e as { status?: number }).status;
          const transient = status === 0 || (status !== undefined && status >= 500);
          if (signal.aborted || !transient || attempt >= 2) throw e;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
    await api(`/api/documents/${init.id}/complete`, { method: "POST" });
    onProgress(1);
  } catch (e) {
    fetch(`/api/documents/${init.id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  }
}
