// PostgreSQL local para desenvolvimento e testes (sem Docker).
// Uso: npm run db:local  (fica em primeiro plano; Ctrl+C para parar)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const databaseDir = new URL("../.pgdata", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "frota",
  password: "frota-local",
  port,
  persistent: true,
});

if (!existsSync(`${databaseDir}/PG_VERSION`)) await pg.initialise();
await pg.start();
for (const db of ["frota", "frota_test"]) {
  try {
    await pg.createDatabase(db);
  } catch {
    // já existe
  }
}
console.log(`PostgreSQL local em postgresql://frota:frota-local@localhost:${port}/frota`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
