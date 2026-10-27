import { AuthError, assertUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { decryptedStream, json, verifyContentSignature } from "@/lib/documents";
import { ALLOWED_MIME, safeFileName, type AllowedMime } from "@/lib/files";

/** Entrega o arquivo decifrado. Exige sessão E assinatura válida do mesmo usuário (link expira em 5 min). */
export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]/content">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const q = new URL(req.url).searchParams;
    if (!verifyContentSignature(id, user.id, q.get("exp"), q.get("dl"), q.get("sig"))) {
      return json({ error: "Link expirado. Abra o documento novamente." }, 403);
    }
    const doc = await db.document.findFirst({ where: { id, status: "PRONTO", deletedAt: null } });
    if (!doc) return json({ error: "Documento não encontrado." }, 404);

    const ext = ALLOWED_MIME[doc.mime as AllowedMime];
    const base = safeFileName(doc.title).replace(new RegExp(`\\.${ext}$`, "i"), "");
    const name = `${base}.${ext}`;
    const disposition = q.get("dl") === "1" ? "attachment" : "inline";
    return new Response(decryptedStream(doc), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Length": String(doc.size),
        "Content-Disposition": `${disposition}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}
