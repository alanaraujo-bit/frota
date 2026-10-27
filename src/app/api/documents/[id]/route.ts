import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { AuthError, assertUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, sameOrigin, signedContentUrl } from "@/lib/documents";

/** Emite link de curta duração para prévia (?download=0) ou download (?download=1). Qualquer usuário autenticado. */
export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const doc = await db.document.findFirst({ where: { id, status: "PRONTO", deletedAt: null }, select: { id: true, mime: true } });
    if (!doc) return json({ error: "Documento não encontrado." }, 404);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return json({ url: signedContentUrl(doc.id, user.id, download), mime: doc.mime });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}

/** Exclui (lixeira) um documento pronto ou cancela um envio pendente. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    if (!sameOrigin(req)) return json({ error: "Origem inválida." }, 403);
    const user = await assertUser(true);
    const { id } = await ctx.params;
    const doc = await db.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc || (doc.status === "PENDENTE" && doc.uploadedById !== user.id)) return json({ error: "Documento não encontrado." }, 404);
    await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
    if (doc.status === "PRONTO") {
      await audit(user.id, "delete", "document", id, { veiculo: doc.vehicleId, tipo: doc.type, titulo: doc.title });
      revalidatePath(`/veiculos/${doc.vehicleId}`);
    }
    return json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}
