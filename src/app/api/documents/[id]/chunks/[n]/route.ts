import { AuthError, assertUser } from "@/lib/auth/dal";
import { encryptChunk, unwrapKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { json, masterKey, sameOrigin, store } from "@/lib/documents";
import { CHUNK_BYTES, sniffMime } from "@/lib/files";
import { chunkKey } from "@/lib/storage";

/** Recebe um bloco (≤ 3 MB), confere tamanho e assinatura binária, cifra e grava. Só quem iniciou o envio. */
export async function PUT(req: Request, ctx: RouteContext<"/api/documents/[id]/chunks/[n]">) {
  try {
    if (!sameOrigin(req)) return json({ error: "Origem inválida." }, 403);
    const user = await assertUser(true);
    const { id, n: nRaw } = await ctx.params;
    const n = Number(nRaw);
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc || doc.uploadedById !== user.id || doc.status !== "PENDENTE" || doc.deletedAt) {
      return json({ error: "Envio não encontrado." }, 404);
    }
    if (!Number.isInteger(n) || n < 0 || n >= doc.chunkCount || n > doc.chunksStored) {
      return json({ error: "Bloco fora de ordem." }, 409);
    }
    const expected = n < doc.chunkCount - 1 ? CHUNK_BYTES : doc.size - CHUNK_BYTES * (doc.chunkCount - 1);
    if (Number(req.headers.get("content-length") ?? expected) !== expected) return json({ error: "Tamanho do bloco inválido." }, 400);

    const body = Buffer.from(await req.arrayBuffer());
    if (body.length !== expected) return json({ error: "Tamanho do bloco inválido." }, 400);
    if (n === 0 && sniffMime(body.subarray(0, 16)) !== doc.mime) {
      await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
      return json({ error: "O conteúdo do arquivo não corresponde a PDF/JPG/PNG/WEBP." }, 415);
    }

    const dek = unwrapKey(masterKey(), doc.wrappedKey, doc.id);
    await store().put(chunkKey(doc.id, n), encryptChunk(dek, doc.id, n, body));
    await db.document.update({ where: { id }, data: { chunksStored: Math.max(doc.chunksStored, n + 1) } });
    return json({ ok: true, received: n });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}
