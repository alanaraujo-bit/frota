// Integração com PostgreSQL real (banco frota_test). Requer `npm run db:local` ou TEST_DATABASE_URL.
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { loadSeedFile, runSeed } from "../../prisma/seed-core";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://frota:frota-local@localhost:5433/frota_test";
let db: PrismaClient;

beforeAll(async () => {
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("Testes de integração só rodam em banco *_test.");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await db.$executeRawUnsafe(
    'TRUNCATE "AuditLog","VehicleView","Document","Vehicle","Group","LoginAttempt","Invite","Session","User" CASCADE',
  );
}, 120_000);
afterAll(() => db?.$disconnect());

describe("seed da planilha", () => {
  it("arquivo de seed tem 102 veículos em 8 grupos", () => {
    const data = loadSeedFile();
    expect(data.grupos).toHaveLength(8);
    expect(data.veiculos).toHaveLength(102);
  });

  it("importa 102 veículos e 8 grupos, e não duplica numa nova execução", async () => {
    const first = await runSeed(db);
    expect(first).toMatchObject({ groupsCreated: 8, vehiclesCreated: 102, groups: 8, vehicles: 102 });
    const second = await runSeed(db);
    expect(second).toMatchObject({ groupsCreated: 0, vehiclesCreated: 0, groups: 8, vehicles: 102 });
    expect(await db.vehicle.count()).toBe(102);
    expect(await db.group.count()).toBe(8);
  });

  it("preserva a placa anômala sem corrigir e sinaliza para revisão", async () => {
    const v = await db.vehicle.findFirstOrThrow({ where: { plate: "TUY3H251" } });
    expect(v.plateNeedsReview).toBe(true);
    expect(v.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: "PLACA_FORMATO" })]));
    expect(await db.vehicle.count({ where: { plate: "TUY3H25" } })).toBe(1);
  });

  it("RES1J06 fica sem chassi, com o valor original preservado na origem", async () => {
    const v = await db.vehicle.findFirstOrThrow({ where: { plate: "RES1J06" } });
    expect(v.chassis).toBeNull();
    expect((v.sourceRaw as { celulas: Record<string, string> }).celulas.C3).toBe("CHASSI");
  });

  it("RENAVAM é texto e DATA não vira vencimento", async () => {
    const v = await db.vehicle.findFirstOrThrow({ where: { plate: "TWA4I93" } });
    expect(typeof v.renavam).toBe("string");
    expect(v.sheetReference).toBe("MAIO");
    expect(v.sheetReferenceAt).toBeNull();
    const legacy = await db.vehicle.groupBy({ by: ["legacyStatus"], _count: true });
    expect(Object.fromEntries(legacy.map((l) => [l.legacyStatus ?? "vazio", l._count]))).toEqual({ OK: 74, vazio: 11, ATRASADO: 16, PENDENTE: 1 });
  });

  it("edição feita no app sobrevive a uma nova execução do seed", async () => {
    const v = await db.vehicle.findFirstOrThrow({ where: { plate: "QVG5838" } });
    await db.vehicle.update({ where: { id: v.id }, data: { notes: "editado no app" } });
    await runSeed(db);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: v.id } })).notes).toBe("editado no app");
  });
});
