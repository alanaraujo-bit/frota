import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

type Creds = Record<"admin" | "reader" | "locked", { email: string; password: string }>;
export const creds = (): Creds => JSON.parse(readFileSync(path.join(__dirname, ".auth.json"), "utf8"));

export async function login(page: Page, who: "admin" | "reader") {
  const c = creds()[who];
  await page.goto("/entrar");
  await hydrated(page);
  await page.getByLabel("E-mail").fill(c.email);
  await page.getByLabel("Senha").fill(c.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Qual veículo?" })).toBeVisible();
}

/** PDF mínimo válido. */
export function pdfBuffer(text = "FROTA teste") {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 20 50 Td (${text}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return Buffer.from(body);
}

/** PNG 1x1. */
export const pngBuffer = () =>
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export async function noHorizontalScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, "rolagem horizontal").toBeLessThanOrEqual(iw);
}

export const hydrated = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

/** Busca pela placa na tela inicial e abre a ficha (espera a navegação animada terminar). */
export async function openVehicle(page: Page, query: string) {
  await page.getByRole("combobox", { name: /Buscar por placa/ }).fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/veiculos\/[0-9a-f-]{36}$/);
  await expect(page.locator("main").getByRole("link", { name: "Veículos", exact: true })).toBeVisible();
}
