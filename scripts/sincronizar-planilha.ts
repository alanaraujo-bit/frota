// Atualiza o banco para refletir a planilha final (a planilha prevalece sobre os dados vindos da planilha antiga).
// Uso: npx tsx scripts/sincronizar-planilha.ts <frota_seed.json | -> [--aplicar]
//   "-" lê o JSON da entrada padrão. Sem --aplicar, só simula e mostra o que mudaria.
// Regras:
// - Veículo casa pela placa normalizada (a linha da planilha muda entre versões; a placa não).
// - Casou: os campos da planilha são sobrescritos e o veículo é desarquivado. Observações e documentos ficam.
// - Não casou: é criado. Veículo vindo da planilha antiga que sumiu da nova: arquivado (nunca apagado).
// - Veículos cadastrados só no app (sem origem na planilha) e sem placa na planilha: não são tocados.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { groupData, vehicleData, type SeedFile } from "../prisma/seed-core";
import { plateKey } from "../src/lib/plate";

const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error("Uso: tsx scripts/sincronizar-planilha.ts <frota_seed.json | -> [--aplicar]");
const apply = flags.includes("--aplicar");
const data: SeedFile = JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8"));

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// O jsonb do Postgres reordena chaves; compara com as chaves ordenadas.
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" && !(v instanceof Date)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]))
    : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a ?? null)) === JSON.stringify(canon(b ?? null));
function changes(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { de: unknown; para: unknown }> = {};
  for (const k of Object.keys(after)) if (!same(before[k], after[k])) out[k] = { de: before[k] ?? null, para: after[k] ?? null };
  return out;
}
// sheetReferenceAt vem do banco como Date e da planilha como Date: compara pelo dia.
const norm = (v: Record<string, unknown>) => ({
  ...v,
  sheetReferenceAt: v.sheetReferenceAt instanceof Date ? v.sheetReferenceAt.toISOString().slice(0, 10) : v.sheetReferenceAt,
});

async function main() {
  const keys = data.veiculos.map((v) => plateKey(v.placa));
  const dupSheet = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupSheet.length) throw new Error(`Placas repetidas na planilha: ${[...new Set(dupSheet)].join(", ")}. Corrija antes.`);

  const groups = await db.group.findMany();
  const vehicles = await db.vehicle.findMany({ include: { group: { select: { name: true } } } });
  const userEdits = await db.auditLog.findMany({
    where: { entity: "vehicle", action: "update", userId: { not: null } },
    select: { entityId: true },
  });
  const editedInApp = new Set(userEdits.map((e) => e.entityId));

  const plan = {
    groupsCreate: [] as SeedFile["grupos"],
    groupsUpdate: [] as { id: string; data: ReturnType<typeof groupData>; diff: object }[],
    create: [] as SeedFile["veiculos"],
    update: [] as { id: string; plate: string; v: SeedFile["veiculos"][number]; diff: Record<string, unknown>; restore: boolean; overwritesAppEdit: boolean }[],
    archive: [] as { id: string; plate: string; group: string; sourceKey: string }[],
  };

  for (const g of data.grupos) {
    const row = groups.find((x) => x.sourceKey === g.chave);
    if (!row) plan.groupsCreate.push(g);
    else {
      const d = changes(row, groupData(g));
      if (Object.keys(d).length || row.archivedAt) plan.groupsUpdate.push({ id: row.id, data: groupData(g), diff: d });
    }
  }

  const used = new Set<string>();
  for (const v of data.veiculos) {
    const key = plateKey(v.placa);
    const candidates = vehicles.filter((x) => x.plateKey === key && !used.has(x.id));
    // Preferência: mesma origem, depois qualquer origem na planilha, depois cadastrado no app.
    const match =
      candidates.find((x) => x.sourceKey === v.chaveOrigem) ?? candidates.find((x) => x.sourceKey) ?? candidates[0];
    if (!match) {
      plan.create.push(v);
      continue;
    }
    used.add(match.id);
    const groupId = groups.find((g) => g.sourceKey === v.grupo)?.id ?? `novo:${v.grupo}`;
    const d = changes(norm(match), norm(vehicleData(v, groupId, data.fonte)));
    if (Object.keys(d).length || match.archivedAt)
      plan.update.push({ id: match.id, plate: match.plate, v, diff: d, restore: !!match.archivedAt, overwritesAppEdit: editedInApp.has(match.id) });
  }

  for (const x of vehicles)
    if (x.sourceKey && !used.has(x.id) && !x.archivedAt)
      plan.archive.push({ id: x.id, plate: x.plate, group: x.group.name, sourceKey: x.sourceKey });

  // ---------- Relatório ----------
  const fieldCount: Record<string, number> = {};
  for (const u of plan.update) for (const k of Object.keys(u.diff)) if (k !== "sourceKey" && k !== "sourceRaw" && k !== "sheetOrder") fieldCount[k] = (fieldCount[k] ?? 0) + 1;
  console.log(`Planilha: ${data.grupos.length} grupos, ${data.veiculos.length} veículos (${data.fonte})`);
  console.log(`Banco atual: ${groups.length} grupos, ${vehicles.length} veículos (${vehicles.filter((v) => v.archivedAt).length} arquivados)`);
  console.log(`\nGrupos a criar: ${plan.groupsCreate.length}${plan.groupsCreate.map((g) => `\n  + ${g.nome}`).join("")}`);
  console.log(`Grupos a atualizar: ${plan.groupsUpdate.length}`);
  for (const g of plan.groupsUpdate) console.log(`  ~ ${g.data.name}: ${Object.keys(g.diff).join(", ") || "desarquivar"}`);
  console.log(`\nVeículos a criar: ${plan.create.length}${plan.create.map((v) => `\n  + ${v.placa} (${v.grupo.trim()})`).join("")}`);
  const real = plan.update.filter((u) => Object.keys(u.diff).some((k) => !["sourceKey", "sourceRaw", "sheetOrder"].includes(k)) || u.restore);
  console.log(`Veículos com dados alterados: ${real.length} (mais ${plan.update.length - real.length} só com posição/linha na planilha)`);
  for (const [k, n] of Object.entries(fieldCount).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
  for (const u of real.filter((u) => u.restore)) console.log(`  ↺ ${u.plate} volta do arquivo`);
  const lost = real.filter((u) => u.overwritesAppEdit);
  console.log(`Veículos editados no app que a planilha vai sobrescrever: ${lost.length}${lost.map((u) => `\n  ! ${u.plate}: ${Object.keys(u.diff).filter((k) => !["sourceKey", "sourceRaw", "sheetOrder"].includes(k)).join(", ")}`).join("")}`);
  console.log(`Veículos a arquivar (sumiram da planilha): ${plan.archive.length}${plan.archive.map((a) => `\n  - ${a.plate} (${a.group})`).join("")}`);

  if (!apply) {
    console.log("\nSimulação: nada foi gravado. Rode de novo com --aplicar para gravar.");
    return;
  }

  await db.$transaction(
    async (tx) => {
      const groupIds = new Map(groups.filter((g) => g.sourceKey).map((g) => [g.sourceKey!, g.id]));
      for (const g of plan.groupsCreate) {
        const row = await tx.group.create({ data: groupData(g) });
        groupIds.set(g.chave, row.id);
        await tx.auditLog.create({ data: { action: "create", entity: "group", entityId: row.id, data: { nome: g.nome, origem: "planilha final" } } });
      }
      for (const g of plan.groupsUpdate) {
        await tx.group.update({ where: { id: g.id }, data: { ...g.data, archivedAt: null } });
        await tx.auditLog.create({ data: { action: "update", entity: "group", entityId: g.id, data: g.diff as Prisma.InputJsonValue } });
      }
      // Libera as chaves de origem antes de redistribuí-las (sourceKey é único e as linhas mudaram).
      const touched = [...plan.update.map((u) => u.id), ...plan.archive.map((a) => a.id)];
      for (const id of touched) await tx.vehicle.update({ where: { id }, data: { sourceKey: `tmp:${id}` } });
      for (const a of plan.archive) {
        await tx.vehicle.update({ where: { id: a.id }, data: { sourceKey: `${a.sourceKey}#fora-da-planilha-final`, archivedAt: new Date() } });
        await tx.auditLog.create({ data: { action: "archive", entity: "vehicle", entityId: a.id, data: { motivo: "fora da planilha final" } } });
      }
      for (const u of plan.update) {
        const d = vehicleData(u.v, groupIds.get(u.v.grupo)!, data.fonte);
        await tx.vehicle.update({ where: { id: u.id }, data: { ...d, archivedAt: null } });
        const visible = Object.fromEntries(Object.entries(u.diff).filter(([k]) => !["sourceKey", "sourceRaw", "sheetOrder", "groupId"].includes(k)));
        if (Object.keys(visible).length || u.restore)
          await tx.auditLog.create({ data: { action: u.restore ? "restore" : "update", entity: "vehicle", entityId: u.id, data: { ...visible, origem: "planilha final" } as Prisma.InputJsonValue } });
      }
      for (const v of plan.create) {
        const row = await tx.vehicle.create({ data: vehicleData(v, groupIds.get(v.grupo)!, data.fonte) });
        await tx.auditLog.create({ data: { action: "create", entity: "vehicle", entityId: row.id, data: { placa: v.placa, origem: "planilha final" } } });
      }
    },
    { timeout: 120_000 },
  );
  console.log("\nAplicado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
