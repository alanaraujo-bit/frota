// Restaura um backup em um banco VAZIO (já migrado) e no armazenamento configurado.
// Uso: npm run restaurar -- frota-2026-10-27T18-00-00-000Z
// Por segurança, recusa se o banco de destino já tiver veículos ou usuários.
import { createHash } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import { TABLES, appStore, backupStore, db, run } from "./lib";

// Campos JSON anuláveis precisam de Prisma.DbNull na inserção.
const NULLABLE_JSON: Record<string, string[]> = { vehicle: ["sourceRaw"], auditLog: ["data"] };

run(async () => {
  const name = process.argv[2]?.replace(/\/$/, "");
  if (!name) throw new Error("Informe o nome do backup, ex.: npm run restaurar -- frota-2026-10-27T18-00-00-000Z");
  const src = backupStore();
  const dest = appStore();

  const manifest = JSON.parse((await src.get(`${name}/manifest.json`)).toString());
  const dbJson = await src.get(`${name}/db.json`);
  if (createHash("sha256").update(dbJson).digest("hex") !== manifest.db.sha256) throw new Error("db.json corrompido (SHA-256 não confere).");
  for (const [k, sha] of Object.entries<string>(manifest.files)) {
    const body = await src.get(`${name}/${k}`);
    if (createHash("sha256").update(body).digest("hex") !== sha) throw new Error(`Anexo corrompido: ${k}`);
  }

  if ((await db.vehicle.count()) > 0 || (await db.user.count()) > 0) {
    throw new Error("O banco de destino não está vazio. Restaure em um banco novo (rode `npm run db:migrate` antes).");
  }

  const { tables } = JSON.parse(dbJson.toString()) as { tables: Record<string, Record<string, unknown>[]> };
  await db.$transaction(async (tx) => {
    for (const t of TABLES) {
      const rows = (tables[t] ?? []).map((r) => {
        const out = { ...r };
        for (const f of NULLABLE_JSON[t] ?? []) if (out[f] === null) out[f] = Prisma.DbNull;
        return out;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (rows.length) await (tx[t] as any).createMany({ data: rows });
    }
  });
  for (const k of Object.keys(manifest.files)) await dest.put(k, await src.get(`${name}/${k}`));
  console.log(`Restaurado ${name}: ${tables.vehicle.length} veículos, ${tables.document.length} documentos, ${Object.keys(manifest.files).length} blocos.`);
});
