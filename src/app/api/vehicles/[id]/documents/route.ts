import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthError, assertUser } from "@/lib/auth/dal";
import { newWrappedKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { json, masterKey, sameOrigin } from "@/lib/documents";
import { CHUNK_BYTES, MAX_FILE_BYTES, isAllowedMime } from "@/lib/files";

const schema = z.object({
  type: z.enum(["CRLV", "VISTORIA", "SEGURO", "OUTRO"]),
  title: z.string().trim().min(1, "Informe um título.").max(120),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  fileName: z.string().trim().min(1).max(200),
  mime: z.string().refine(isAllowedMime, "Formato não aceito. Envie PDF, JPG, PNG ou WEBP."),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Arquivo acima de 25 MB."),
  replacesId: z.uuid().nullable().optional(),
});

/** Inicia um envio: valida, cria o registro PENDENTE e a chave do arquivo. Somente administrador. */
export async function POST(req: Request, ctx: RouteContext<"/api/vehicles/[id]/documents">) {
  try {
    if (!sameOrigin(req)) return json({ error: "Origem inválida." }, 403);
    const user = await assertUser(true);
    const { id: vehicleId } = await ctx.params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, 400);
    const d = parsed.data;

    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!vehicle) return json({ error: "Veículo não encontrado." }, 404);
    if (d.replacesId) {
      const old = await db.document.findFirst({ where: { id: d.replacesId, vehicleId, deletedAt: null, status: "PRONTO" } });
      if (!old) return json({ error: "Documento a substituir não encontrado." }, 404);
    }

    const id = randomUUID();
    const chunkCount = Math.ceil(d.size / CHUNK_BYTES);
    await db.document.create({
      data: {
        id,
        vehicleId,
        type: d.type,
        title: d.title,
        documentDate: d.date ? new Date(`${d.date}T00:00:00Z`) : null,
        fileName: d.fileName,
        mime: d.mime,
        size: d.size,
        chunkCount,
        wrappedKey: newWrappedKey(masterKey(), id),
        replacesId: d.replacesId ?? null,
        uploadedById: user.id,
      },
    });
    return json({ id, chunkSize: CHUNK_BYTES, chunkCount }, 201);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }
}
