import "server-only";
import { decryptChunk, hmac, safeEqual, unwrapKey } from "@/lib/crypto";
import { env } from "@/lib/env";
import { chunkKey, createStore } from "@/lib/storage";

export const store = () => createStore(env());
export const masterKey = () => Buffer.from(env().FILE_MASTER_KEY, "base64");

const LINK_TTL_S = 300;

/** URL de curta duração, emitida só após autorização, presa ao usuário. A rota ainda exige a sessão. */
export function signedContentUrl(docId: string, userId: string, download: boolean) {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_S;
  const dl = download ? "1" : "0";
  const sig = hmac(env().SESSION_SECRET, `doc:${docId}:${userId}:${exp}:${dl}`);
  return `/api/documents/${docId}/content?exp=${exp}&dl=${dl}&sig=${sig}`;
}

export function verifyContentSignature(docId: string, userId: string, exp: string | null, dl: string | null, sig: string | null) {
  if (!exp || !sig || (dl !== "0" && dl !== "1")) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, hmac(env().SESSION_SECRET, `doc:${docId}:${userId}:${exp}:${dl}`));
}

/** Decifra os blocos em sequência, sem carregar o arquivo inteiro na memória. */
export function decryptedStream(doc: { id: string; wrappedKey: string; chunkCount: number }) {
  const dek = unwrapKey(masterKey(), doc.wrappedKey, doc.id);
  const s = store();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= doc.chunkCount) return controller.close();
      try {
        const blob = await s.get(chunkKey(doc.id, i));
        controller.enqueue(new Uint8Array(decryptChunk(dek, doc.id, i, blob)));
        i++;
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

/** Rotas que alteram estado: exige mesma origem (defesa CSRF além do cookie SameSite=Lax). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  if (!origin) return site === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
