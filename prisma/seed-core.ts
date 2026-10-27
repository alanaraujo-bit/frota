import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";
import { plateFormat, plateKey } from "../src/lib/plate";

type SeedGroup = {
  chave: string;
  ordem: number;
  nome: string;
  documento: string;
  tipoDocumento: string;
  tituloOriginal: string;
};

type SeedVehicle = {
  chaveOrigem: string;
  grupo: string;
  aba: string;
  linha: number;
  origem: Record<string, string>;
  alertas: { codigo: string; mensagem: string }[];
  placa: string;
  renavam: string | null;
  chassi: string | null;
  marcaModelo: string | null;
  ano: string | null;
  cor: string | null;
  dataReferencia: string | null;
  dataReferenciaISO: string | null;
  vistoria: string | null;
  situacao: string | null;
  statusPlanilha: string | null;
  contatos: { rotulo: string; valor: string }[];
  ordemPlanilha?: number;
};

export type SeedFile = { fonte: string; grupos: SeedGroup[]; veiculos: SeedVehicle[] };

export function loadSeedFile(file = path.join(__dirname, "..", "frota_seed.json")): SeedFile {
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Importação idempotente: chave = aba (grupo) e aba+linha (veículo).
 * Registros existentes não são sobrescritos — edições feitas no app prevalecem.
 */
export async function runSeed(db: PrismaClient, data: SeedFile = loadSeedFile()) {
  let groupsCreated = 0;
  let vehiclesCreated = 0;
  const groupIds = new Map<string, string>();

  for (const g of data.grupos) {
    const existing = await db.group.findUnique({ where: { sourceKey: g.chave } });
    const row =
      existing ??
      (await db.group.create({
        data: {
          sourceKey: g.chave,
          name: g.nome,
          document: g.documento,
          documentType: g.tipoDocumento,
          sourceTitle: g.tituloOriginal,
          sortOrder: g.ordem,
        },
      }));
    if (!existing) groupsCreated++;
    groupIds.set(g.chave, row.id);
  }

  for (const v of data.veiculos) {
    const exists = await db.vehicle.findUnique({ where: { sourceKey: v.chaveOrigem }, select: { id: true } });
    if (exists) continue;
    await db.vehicle.create({
      data: {
        sourceKey: v.chaveOrigem,
        groupId: groupIds.get(v.grupo)!,
        plate: v.placa,
        plateKey: plateKey(v.placa),
        plateNeedsReview: plateFormat(v.placa) === "invalida",
        renavam: v.renavam,
        chassis: v.chassi,
        makeModel: v.marcaModelo,
        year: v.ano,
        color: v.cor,
        sheetReference: v.dataReferencia,
        sheetReferenceAt: v.dataReferenciaISO ? new Date(`${v.dataReferenciaISO}T00:00:00Z`) : null,
        inspection: v.vistoria,
        legacyStatus: v.situacao,
        sheetStatus: v.statusPlanilha,
        contacts: v.contatos,
        alerts: v.alertas,
        sheetOrder: v.ordemPlanilha ?? null,
        sourceRaw: { fonte: data.fonte, aba: v.aba, linha: v.linha, celulas: v.origem },
      },
    });
    vehiclesCreated++;
  }

  const [groups, vehicles] = await Promise.all([
    db.group.count({ where: { sourceKey: { not: null } } }),
    db.vehicle.count({ where: { sourceKey: { not: null } } }),
  ]);
  return { groupsCreated, vehiclesCreated, groups, vehicles };
}
