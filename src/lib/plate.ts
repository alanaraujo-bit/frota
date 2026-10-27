// Placas: antiga (ABC1234) e Mercosul (ABC1D23). Funções puras, usadas no cliente e no servidor.

const OLD = /^[A-Z]{3}\d{4}$/;
const MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Só letras e dígitos, maiúsculas: tolera espaços, hífens e caixa. */
export function plateKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export type PlateFormat = "antiga" | "mercosul" | "invalida";

export function plateFormat(input: string): PlateFormat {
  const k = plateKey(input);
  if (OLD.test(k)) return "antiga";
  if (MERCOSUL.test(k)) return "mercosul";
  return "invalida";
}

/**
 * Equivalente no outro padrão: o 5º caractere troca dígito <-> letra (0=A … 9=J).
 * Funciona também para trechos digitados com 5+ caracteres.
 */
export function plateAlternate(key: string): string | null {
  if (key.length < 5 || !/^[A-Z]{3}\d/.test(key)) return null;
  const c = key[4];
  let swapped: string;
  if (/\d/.test(c)) swapped = String.fromCharCode(65 + Number(c));
  else if (c >= "A" && c <= "J") swapped = String(c.charCodeAt(0) - 65);
  else return null;
  return key.slice(0, 4) + swapped + key.slice(5);
}

/** Formatação para exibição: ABC-1234 (antiga) ou ABC1D23 (Mercosul); inválida fica como veio. */
export function displayPlate(input: string): string {
  const k = plateKey(input);
  if (OLD.test(k)) return `${k.slice(0, 3)}-${k.slice(3)}`;
  return k || input;
}

export function digitsKey(input: string): string {
  return input.replace(/\D/g, "").replace(/^0+/, "");
}
