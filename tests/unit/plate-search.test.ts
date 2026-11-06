import { describe, expect, it } from "vitest";
import { displayPlate, plateAlternate, plateFormat, plateKey } from "@/lib/plate";
import { responsibleOf, searchVehicles, type SearchItem } from "@/lib/search";

const item = (over: Partial<SearchItem>): SearchItem => ({
  id: over.plate ?? "x",
  plate: "ABC1234",
  renavam: null,
  chassis: null,
  makeModel: null,
  group: "G",
  groupId: "g",
  responsible: null,
  legacyStatus: null,
  archived: false,
  needsReview: false,
  ...over,
});

describe("placa", () => {
  it("normaliza espaços, hífens e caixa", () => {
    expect(plateKey(" abc-1d23 ")).toBe("ABC1D23");
    expect(plateKey("qvg 5838")).toBe("QVG5838");
  });
  it("detecta formato", () => {
    expect(plateFormat("QVG5838")).toBe("antiga");
    expect(plateFormat("TWA4I93")).toBe("mercosul");
    expect(plateFormat("TUY3H251")).toBe("invalida");
  });
  it("converte entre antiga e Mercosul", () => {
    expect(plateAlternate("QVG5838")).toBe("QVG5I38");
    expect(plateAlternate("QVG5I38")).toBe("QVG5838");
    expect(plateAlternate("AB")).toBeNull();
  });
  it("exibe antiga com hífen e Mercosul sem", () => {
    expect(displayPlate("qvg5838")).toBe("QVG-5838");
    expect(displayPlate("twa4i93")).toBe("TWA4I93");
    expect(displayPlate("TUY3H251")).toBe("TUY3H251");
  });
});

describe("busca", () => {
  const items = [
    item({ plate: "QVG5838", renavam: "1000000001", chassis: "9BWZZZ377VT004251", makeModel: "HONDA/POP 110I" }),
    item({ plate: "TUY3H25", renavam: "1234567890" }),
    item({ plate: "TUY3H251", renavam: "1234567891", needsReview: true }),
    item({ plate: "RES1J06", renavam: "1000000002", makeModel: "VW/T CROSS CL TSI AD", group: "GRUPO TESTE" }),
  ];

  it("acha placa exata com hífen e minúsculas", () => {
    expect(searchVehicles(items, "qvg-5838")[0].item.plate).toBe("QVG5838");
  });
  it("acha placa antiga digitada no formato Mercosul (e vice-versa)", () => {
    expect(searchVehicles(items, "QVG5I38")[0].item.plate).toBe("QVG5838");
    expect(searchVehicles(items, "RES1906")[0].item.plate).toBe("RES1J06");
  });
  it("placa exata vem antes das parecidas", () => {
    const r = searchVehicles(items, "TUY3H25");
    expect(r.map((h) => h.item.plate)).toEqual(["TUY3H25", "TUY3H251"]);
  });
  it("acha por RENAVAM, inclusive com zero à esquerda", () => {
    expect(searchVehicles(items, "01234567890")[0].item.plate).toBe("TUY3H25");
  });
  it("acha pelos últimos dígitos do chassi", () => {
    const r = searchVehicles(items, "004251");
    expect(r[0].item.plate).toBe("QVG5838");
    expect(r[0].field).toBe("chassi");
  });
  it("acha por modelo e grupo, sem acento", () => {
    expect(searchVehicles(items, "t cross")[0].item.plate).toBe("RES1J06");
  });
  it("acha pelo responsável, sem acento", () => {
    const r = searchVehicles([...items, item({ plate: "TVO5C12", responsible: "SECRETARIA DA AGRICULTURA · RAFAEL" })], "rafael");
    expect(r[0].item.plate).toBe("TVO5C12");
    expect(r[0].field).toBe("responsavel");
  });
  it("responsável junta nomes, tira telefones e repetidos", () => {
    expect(
      responsibleOf([
        { rotulo: "RESPONSÁVEL", valor: "ANUAR FILHO" },
        { rotulo: "CONTATO", valor: "(94)99162-1344" },
        { rotulo: "RESPONSAVÉL", valor: "anuar filho" },
        { rotulo: "X", valor: "ROBSON" },
      ]),
    ).toBe("ANUAR FILHO · ROBSON");
    expect(responsibleOf([])).toBeNull();
  });
  it("busca vazia retorna nada", () => {
    expect(searchVehicles(items, "  - ")).toEqual([]);
  });
});
