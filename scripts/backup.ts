// Backup completo: banco (todas as tabelas, JSON) + anexos (blocos já cifrados) + manifesto com SHA-256.
// Uso: npm run backup            (destino: BACKUP_S3_BUCKET ou pasta BACKUP_DIR, padrão ./backups)
// Os anexos continuam cifrados: guarde FILE_MASTER_KEY em local separado, sem ela o backup não abre.
import { createHash } from "node:crypto";
import { TABLES, appStore, backupStore, db, run } from "./lib";

run(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = `frota-${stamp}/`;
  const dest = backupStore();
  const src = appStore();

  const dump: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dump[t] = await (db[t] as any).findMany();
  }
  const dbJson = Buffer.from(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: dump }));
  await dest.put(`${prefix}db.json`, dbJson);

  const keys = await src.list("docs/");
  const files: Record<string, string> = {};
  for (const k of keys) {
    const body = await src.get(k);
    files[k] = createHash("sha256").update(body).digest("hex");
    await dest.put(`${prefix}${k}`, body);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    db: { sha256: createHash("sha256").update(dbJson).digest("hex"), rows: Object.fromEntries(TABLES.map((t) => [t, dump[t].length])) },
    files,
  };
  await dest.put(`${prefix}manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)));
  console.log(`Backup ${prefix} concluído: ${manifest.db.rows.vehicle} veículos, ${manifest.db.rows.document} documentos, ${keys.length} blocos.`);
});
