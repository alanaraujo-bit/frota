// Bootstrap do primeiro administrador, sem senha padrão.
// Uso: npm run admin:criar -- --email pessoa@empresa.com --nome "Nome Completo"
// Imprime um link de uso único (48 h) para a pessoa definir a própria senha.
import "dotenv/config";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createInviteLink } from "../src/lib/auth/invite";

const { values } = parseArgs({ options: { email: { type: "string" }, nome: { type: "string" } } });
const email = values.email?.trim().toLowerCase();
const name = values.nome?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Uso: npm run admin:criar -- --email pessoa@empresa.com --nome "Nome Completo"');
  process.exit(1);
}
const appUrl = process.env.APP_URL ?? "";
if (!appUrl) {
  console.error("Defina APP_URL (endereço público do app) antes de gerar o link.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const user = await db.user.upsert({
    where: { email: email! },
    update: { role: "ADMIN", active: true },
    create: { email: email!, name: name!, role: "ADMIN" },
  });
  const link = await createInviteLink(db, appUrl, user.id, null);
  await db.auditLog.create({ data: { action: "bootstrap_admin", entity: "user", entityId: user.id } });
  console.log(`Administrador: ${email}\nLink para definir a senha (válido por ${link.hours} h, uso único):\n${link.url}`);
}
main().finally(() => db.$disconnect());
