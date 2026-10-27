import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/auth/password";
import { runSeed } from "../../prisma/seed-core";


// Executado via tsx (o client Prisma gerado é ESM). Uso: tsx tests/e2e/setup-db.ts <url>
const E2E_DB = process.argv[2];
const AUTH_FILE = path.join(__dirname, ".auth.json");

async function main() {
  const url = new URL(E2E_DB);
  const name = url.pathname.slice(1);
  if (!name.endsWith("_e2e")) throw new Error("E2E só roda em banco *_e2e.");

  const admin = new pg.Client({ connectionString: Object.assign(new URL(E2E_DB), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: E2E_DB }, stdio: "pipe" });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: E2E_DB }) });
  await db.$executeRawUnsafe('TRUNCATE "AuditLog","VehicleView","Document","Vehicle","Group","LoginAttempt","Invite","Session","User" CASCADE');
  rmSync(path.join(__dirname, "..", "..", ".storage-e2e"), { recursive: true, force: true });
  const seed = await runSeed(db);
  if (seed.vehicles !== 85 || seed.groups !== 7) throw new Error(`Seed inesperado: ${JSON.stringify(seed)}`);

  // Credenciais de teste geradas a cada execução (nunca reaproveitadas fora do E2E).
  const creds = {
    admin: { email: "admin@e2e.test", password: `adm-${randomBytes(9).toString("base64url")}` },
    reader: { email: "leitura@e2e.test", password: `lei-${randomBytes(9).toString("base64url")}` },
    locked: { email: "bloqueio@e2e.test", password: `blk-${randomBytes(9).toString("base64url")}` },
  };
  await db.user.create({ data: { email: creds.admin.email, name: "Ana Admin", role: "ADMIN", passwordHash: await hashPassword(creds.admin.password) } });
  await db.user.create({ data: { email: creds.reader.email, name: "Lia Leitura", role: "LEITURA", passwordHash: await hashPassword(creds.reader.password) } });
  await db.user.create({ data: { email: creds.locked.email, name: "Bia Bloqueio", role: "LEITURA", passwordHash: await hashPassword(creds.locked.password) } });
  await db.$disconnect();
  writeFileSync(AUTH_FILE, JSON.stringify(creds));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
