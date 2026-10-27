import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { runSeed } from "./seed-core";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// frota_seed.json tem dados reais (LGPD) e fica fora do git; sem ele, não há o que importar.
if (!existsSync(path.join(__dirname, "..", "frota_seed.json"))) {
  console.log("Seed: frota_seed.json ausente, importação ignorada.");
  process.exit(0);
}

runSeed(db)
  .then((r) => {
    console.log(
      `Seed: ${r.groupsCreated} grupos e ${r.vehiclesCreated} veículos criados agora; ` +
        `total importado da planilha: ${r.groups} grupos, ${r.vehicles} veículos.`,
    );
  })
  .finally(() => db.$disconnect());
