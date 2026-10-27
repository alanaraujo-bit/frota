"""Extrai a planilha original de frota para frota_seed.json e diagnostico_frota.md.

Uso: python -I scripts/planilha/extrair.py "<planilha.xlsx>" <dir_saida> [dir_openpyxl]

Regras: preserva valores e origem (aba + célula) de cada linha, não corrige
placas, não pressupõe vencimento em DATA, não funde registros suspeitos.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

if len(sys.argv) > 3:
    sys.path.insert(0, sys.argv[3])
import openpyxl  # noqa: E402

CNPJ = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
CPF = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
PLACA_ANTIGA = re.compile(r"^[A-Z]{3}\d{4}$")
PLACA_MERCOSUL = re.compile(r"^[A-Z]{3}\d[A-Z]\d{2}$")
VIN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")

CAMPOS = {
    "PLACA": "placa", "PLACAS": "placa",
    "RENAVAM": "renavam", "RENAVAN": "renavam",
    "CHASSI": "chassi",
    "MARC/MOD": "marcaModelo", "MAR/MOD": "marcaModelo", "MARC-MOD": "marcaModelo",
    "ANO": "ano", "COR": "cor", "DATA": "data",
    "VISTORIA": "vistoria", "EM DIAS": "situacao", "STATUS": "statusPlanilha",
}


def texto(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


def limpo(v):
    t = texto(v)
    if t is None:
        return None
    t = re.sub(r"\s+", " ", t).strip()
    return t or None


def rotulo(v):
    return re.sub(r"\s+", " ", str(v)).strip().upper()


def extrair(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    grupos, veiculos = [], []
    for ordem_aba, ws in enumerate(wb.worksheets):
        linhas = list(ws.iter_rows())
        cab_idx = next(i for i, r in enumerate(linhas) if any(
            c.value is not None and rotulo(c.value) in ("PLACA", "PLACAS") for c in r))
        titulo_row = linhas[cab_idx - 1]
        titulo = next(limpo(c.value) for c in titulo_row if c.value is not None
                      and (CNPJ.search(str(c.value)) or CPF.search(str(c.value))))
        doc = (CNPJ.search(titulo) or CPF.search(titulo)).group(0)
        tipo_doc = "CNPJ" if CNPJ.search(titulo) else "CPF"
        nome = re.sub(r"^VEICULOS\s*", "", titulo.replace(doc, "")).strip(" -")
        nome = re.sub(r"\s+-\s*$", "", nome).strip()
        grupo_chave = ws.title.strip()
        grupos.append({
            "chave": grupo_chave, "aba": ws.title, "ordem": ordem_aba + 1,
            "nome": nome, "documento": doc, "tipoDocumento": tipo_doc,
            "tituloOriginal": titulo,
        })

        # rótulo de cada coluna: linha de cabeçalho; se vazia, a linha de título.
        mapa, extras = {}, {}
        for c in linhas[cab_idx]:
            if c.value is not None and rotulo(c.value) in CAMPOS:
                mapa[c.column_letter] = CAMPOS[rotulo(c.value)]
            elif c.value is not None:
                extras[c.column_letter] = limpo(c.value)
        for c in titulo_row:
            if c.value is not None and c.column_letter not in mapa and c.column_letter not in extras \
                    and not (CNPJ.search(str(c.value)) or CPF.search(str(c.value))):
                extras[c.column_letter] = limpo(c.value)
        col_placa = next(k for k, v in mapa.items() if v == "placa")
        if "chassi" not in mapa.values():
            # Aba sem rótulo de chassi: coluna C sem rótulo no cabeçalho, mas contém chassis.
            mapa["C"] = "chassi"

        for r in linhas[cab_idx + 1:]:
            celulas = {c.column_letter: c for c in r if c.value is not None}
            if col_placa not in celulas:
                continue
            linha = r[0].row
            origem = {f"{k}{linha}": texto(c.value) for k, c in sorted(celulas.items())}
            v = {"chaveOrigem": f"{grupo_chave}!{linha}", "grupo": grupo_chave,
                 "aba": ws.title, "linha": linha, "origem": origem, "alertas": []}
            for col, campo in mapa.items():
                cel = celulas.get(col)
                if campo == "data":
                    if cel is not None and isinstance(cel.value, datetime):
                        v["dataReferenciaISO"] = cel.value.strftime("%Y-%m-%d")
                        v["dataReferencia"] = cel.value.strftime("%d/%m/%Y")
                    else:
                        v["dataReferenciaISO"] = None
                        v["dataReferencia"] = limpo(cel.value) if cel else None
                else:
                    v[campo] = limpo(cel.value) if cel else None
            if "A" in celulas and "A" not in mapa and isinstance(celulas["A"].value, (int, float)):
                v["ordemPlanilha"] = int(celulas["A"].value)
            v["contatos"] = [{"rotulo": extras[col], "valor": limpo(celulas[col].value)}
                             for col in sorted(extras) if col in celulas]
            for campo in ("ano", "cor", "statusPlanilha", "vistoria", "situacao", "chassi", "marcaModelo"):
                v.setdefault(campo, None)
            placa = v["placa"].upper()
            if not (PLACA_ANTIGA.match(placa) or PLACA_MERCOSUL.match(placa)):
                v["alertas"].append({"codigo": "PLACA_FORMATO",
                                     "mensagem": f"Placa '{v['placa']}' com {len(placa)} caracteres fora do padrão antigo/Mercosul. Mantida sem correção para revisão."})
            ch = v["chassi"]
            if ch is None or not VIN.match(ch.upper()):
                v["alertas"].append({"codigo": "CHASSI_INVALIDO",
                                     "mensagem": f"Sem chassi válido na planilha (valor: {ch!r})."})
                v["chassi"] = None
            veiculos.append(v)
    return grupos, veiculos


def diagnostico(grupos, veiculos):
    out = ["# Diagnóstico da planilha de frota", "",
           "Gerado por `scripts/planilha/extrair.py` a partir de `PLANILHA DE FROTA DE VEICULOS.xlsx`.", "",
           f"- **Veículos:** {len(veiculos)}", f"- **Grupos/titulares:** {len(grupos)}", "",
           "| # | Aba | Titular | Documento | Veículos |", "|---|---|---|---|---|"]
    por_grupo = Counter(v["grupo"] for v in veiculos)
    for g in grupos:
        out.append(f"| {g['ordem']} | `{g['aba']}` | {g['nome']} | {g['tipoDocumento']} | {por_grupo[g['chave']]} |")
    out += ["", "## Anomalias sinalizadas (não corrigidas)", ""]
    for v in veiculos:
        for a in v["alertas"]:
            out.append(f"- `{v['chaveOrigem']}` **{v['placa']}** — {a['mensagem']}")
    out += ["", "## Possíveis conflitos (não fundidos)", ""]
    norm = defaultdict(list)
    for v in veiculos:
        norm[v["placa"].upper()].append(v["chaveOrigem"])
    dups = {k: x for k, x in norm.items() if len(x) > 1}
    out.append(f"- Placas repetidas: {len(dups)}" + "".join(f"\n  - {k}: {x}" for k, x in dups.items()))
    for campo in ("renavam", "chassi"):
        c = Counter(v[campo] for v in veiculos if v[campo])
        rep = {k: n for k, n in c.items() if n > 1}
        out.append(f"- {campo.upper()} repetidos: {len(rep)}" + "".join(f"\n  - {k} ({n}x)" for k, n in rep.items()))
    placas = sorted(norm)
    for p in placas:
        for q in placas:
            if p != q and q.startswith(p) and len(q) == len(p) + 1:
                out.append(f"- Placas semelhantes: **{p}** (`{norm[p][0]}`) e **{q}** (`{norm[q][0]}`) — RENAVAM e chassi distintos, mantidas separadas.")
    out += ["", "## Observações de interpretação", "",
            "- **DATA** mistura nomes de mês sem ano (texto) e datas completas. Importada como `Referência da planilha`; não é tratada como vencimento.",
            "  - Valores em texto: " + ", ".join(sorted({v['dataReferencia'] for v in veiculos if v['dataReferencia'] and not v['dataReferenciaISO']})),
            f"  - Datas completas: {sum(1 for v in veiculos if v['dataReferenciaISO'])}; sem valor: {sum(1 for v in veiculos if not v['dataReferencia'])}.",
            "- **EM DIAS** (`OK`/`ATRASADO`/`PENDENTE`) é situação legada copiada da planilha, não um cálculo. Distribuição: "
            + ", ".join(f"{k or 'vazio'}={n}" for k, n in Counter(v['situacao'] for v in veiculos).most_common()),
            "- **VISTORIA** preservada como texto. Distribuição: "
            + ", ".join(f"{k or 'vazio'}={n}" for k, n in Counter(v['vistoria'] for v in veiculos).most_common()),
            "- **RENAVAM** é texto. O Excel guardou como número, então zeros à esquerda podem ter sido perdidos "
            f"({sum(1 for v in veiculos if v['renavam'] and len(v['renavam']) < 11)} valores com menos de 11 dígitos). O valor é mantido como está; a busca ignora zeros à esquerda.",
            "- Aba sem rótulo de chassi no cabeçalho: coluna C tratada como CHASSI; células com o texto literal `CHASSI` ficam sem chassi válido.",
            "- Colunas de responsáveis/contatos têm rótulos diferentes por aba (ex.: `CONTATO` com telefone, `TELEFONE` com nome). São importadas como pares rótulo/valor verbatim, sem reinterpretação.",
            "- Coluna `STATUS` existe apenas em uma aba; importada em `statusPlanilha`.",
            "- Erros de digitação (ex.: `ISSAN/KICKS PLAY ACTIVE`, `APAIO UBS`) mantidos como estão.",
            "- Documento do titular (CNPJ/CPF) e telefones são dados pessoais/privados (LGPD): só aparecem para usuários autenticados e nunca em logs."]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    grupos, veiculos = extrair(sys.argv[1])
    destino = sys.argv[2]
    with open(f"{destino}/frota_seed.json", "w", encoding="utf-8") as f:
        json.dump({"fonte": "PLANILHA DE FROTA DE VEICULOS.xlsx", "grupos": grupos, "veiculos": veiculos},
                  f, ensure_ascii=False, indent=2)
    with open(f"{destino}/diagnostico_frota.md", "w", encoding="utf-8") as f:
        f.write(diagnostico(grupos, veiculos))
    print(f"{len(grupos)} grupos, {len(veiculos)} veículos")
