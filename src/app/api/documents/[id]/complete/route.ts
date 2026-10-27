import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { AuthError, assertUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, sameOrigin } from "@/lib/documents";

/** Conclui o envio. Se for substituição, o anterior vai para a lixeira (recuperável até a limpeza). */
export async function POST(req: Request, ctx: RouteContext<"/api/documents/[id]/complete">) {
  try {
    if (!sameOrigin(req)) return json({ error: "Origem inválida." }, 403);
    const user = await assertUser(true);
    const { id } = await ctx.params;
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc || doc.uploadedById !== user.id || doc.status !== "PENDENTE" || doc.deletedAt) {
      return json({ error: "Envio não encontrado." }, 404);
    }
    if (doc.chunksStored !== doc.chunkCount) return json({ error: "Envio incompleto." }, 409);

    await db.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status: "PRONTO" } });
      if (doc.replacesId) {
        await tx.document.updateMany({ where: { id: doc.replacesId, vehicleId: doc.vehicleId, deletedAt: null }, data: { deletedAt: new Date() } });
      }
      await audit(
        user.id,
        doc.replacesId ? "replace" : "upload",
        "document",
        id,
        { veiculo: doc.vehicleId, tipo: doc.type, titulo: doc.title, tamanho: doc.size, substitui: doc.replacesId },
        tx,
      );
    });
    revalidatePath(`/veiculos/${doc.vehicleId}`);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}
