import { digitsKey, plateAlternate, plateKey } from "./plate";

export type SearchItem = {
  id: string;
  plate: string;
  renavam: string | null;
  chassis: string | null;
  makeModel: string | null;
  group: string;
  groupId: string;
  legacyStatus: string | null;
  archived: boolean;
  needsReview: boolean;
};

export type SearchHit = { item: SearchItem; score: number; field: "placa" | "renavam" | "chassi" | "texto" };

function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function scoreOne(item: SearchItem, q: string, qAlt: string | null, qDigits: string, qText: string): SearchHit | null {
  const p = plateKey(item.plate);
  const pAlt = plateAlternate(p);
  const plates = [p, pAlt].filter(Boolean) as string[];
  const queries = [q, qAlt].filter(Boolean) as string[];
  let best: SearchHit | null = null;
  const take = (score: number, field: SearchHit["field"]) => {
    if (!best || score > best.score) best = { item, score, field };
  };

  for (const pk of plates) {
    for (const qk of queries) {
      if (pk === qk) take(qk === q && pk === p ? 100 : 95, "placa");
      else if (pk.startsWith(qk)) take(80, "placa");
      else if (qk.length >= 3 && pk.includes(qk)) take(60, "placa");
    }
  }
  if (qDigits.length >= 4 && item.renavam) {
    const r = digitsKey(item.renavam);
    if (r === qDigits) take(90, "renavam");
    else if (r.includes(qDigits)) take(45, "renavam");
  }
  if (q.length >= 4 && item.chassis) {
    const c = plateKey(item.chassis);
    if (c === q) take(90, "chassi");
    else if (c.endsWith(q)) take(55, "chassi");
    else if (c.includes(q)) take(40, "chassi");
  }
  if (qText.length >= 2) {
    if (item.makeModel && fold(item.makeModel).includes(qText)) take(20, "texto");
    else if (fold(item.group).includes(qText)) take(15, "texto");
  }
  return best;
}

/** Busca tolerante: placa (antiga/Mercosul, com ou sem hífen), RENAVAM, chassi, modelo ou grupo. */
export function searchVehicles(items: SearchItem[], query: string, limit = 50): SearchHit[] {
  const q = plateKey(query);
  if (!q) return [];
  const qAlt = plateAlternate(q);
  const qDigits = digitsKey(query);
  const qText = fold(query.trim());
  const hits: SearchHit[] = [];
  for (const item of items) {
    const h = scoreOne(item, q, qAlt, qDigits, qText);
    if (h) hits.push(h);
  }
  hits.sort((a, b) => b.score - a.score || Number(a.item.archived) - Number(b.item.archived) || a.item.plate.localeCompare(b.item.plate));
  return hits.slice(0, limit);
}
