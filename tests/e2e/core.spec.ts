import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { creds, hydrated, login, pdfBuffer, pngBuffer, openVehicle } from "./helpers";

test.describe.configure({ mode: "serial" });

test("login: erro genérico, depois entra", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar/);
  await hydrated(page);
  await page.getByLabel("E-mail").fill(creds().admin.email);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
  await expect(page.getByLabel("E-mail")).toHaveValue(creds().admin.email); // não apaga o que foi digitado
  await login(page, "admin");
});

test("bloqueio após 5 tentativas erradas", async ({ page }) => {
  const c = creds().locked;
  await page.goto("/entrar");
  await hydrated(page);
  for (let i = 0; i < 6; i++) {
    await page.getByLabel("E-mail").fill(c.email);
    await page.getByLabel("Senha").fill(`errada-${i}-xxxxx`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
  }
  await page.getByLabel("E-mail").fill(c.email);
  await page.getByLabel("Senha").fill(c.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Muitas tentativas");
});

test("busca tolerante e abertura da ficha", async ({ page }) => {
  await login(page, "admin");
  const box = page.getByRole("combobox", { name: /Buscar por placa/ });
  await box.fill("qvg-5838");
  await expect(page.getByRole("option").first()).toContainText("HONDA/POP 110I");
  await box.fill("QVG5I38"); // mesma placa no formato Mercosul
  await expect(page.getByRole("option").first()).toContainText("QVG-5838");
  // RENAVAM vem do seed local (dado real, fora do repositório)
  const seed = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "frota_seed.json"), "utf8"));
  const renavam: string = seed.veiculos.find((v: { placa: string }) => v.placa === "TUY3H25").renavam;
  await box.fill(`0${renavam}`); // RENAVAM com zero à esquerda
  await expect(page.getByRole("option").first()).toContainText(`RENAVAM ${renavam}`);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel(/^Placa TUY3H25$/)).toBeVisible();
  await expect(page.getByText("Referência da planilha")).toBeVisible();

  // Ctrl+K em qualquer tela
  await page.keyboard.press("Control+k");
  const pal = page.getByRole("dialog", { name: "Buscar veículo" });
  await pal.getByRole("combobox").fill("tuy3h251");
  await expect(pal.getByRole("option").first()).toContainText("Revisar placa");
});

test("placa anômala preservada e sinalizada", async ({ page }) => {
  await login(page, "admin");
  await openVehicle(page, "TUY3H251");
  await expect(page.getByText(/8 caracteres fora do padrão/)).toBeVisible();
  await expect(page.getByText("Placa para revisar")).toBeVisible();
});

test("sem resultado → cadastrar com placa preenchida, aviso de conflito e edição", async ({ page }) => {
  await login(page, "admin");
  await page.getByRole("combobox", { name: /Buscar por placa/ }).fill("abc-1d23");
  await expect(page.getByText(/Nada encontrado/)).toBeVisible();
  await page.getByRole("link", { name: "Cadastrar veículo ABC1D23" }).click();
  await expect(page.getByRole("textbox", { name: "Placa", exact: true })).toHaveValue("ABC1D23");
  await expect(page.getByText("Placa Mercosul")).toBeVisible();
  await page.getByLabel("Grupo / titular").selectOption({ index: 1 });
  await page.getByLabel("Marca / modelo").fill("FIAT/STRADA TESTE");
  await page.getByRole("button", { name: "Cadastrar veículo" }).click();
  await expect(page.getByText("Veículo cadastrado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FIAT/STRADA TESTE" })).toBeVisible();

  // Duplicata: avisa e só salva com confirmação explícita
  await page.goto("/veiculos/novo?placa=abc1d23");
  await page.getByLabel("Grupo / titular").selectOption({ index: 2 });
  await page.getByRole("button", { name: "Cadastrar veículo" }).click();
  await expect(page.getByText(/Já existe veículo com a placa ABC1D23/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar mesmo assim" }).click();
  await expect(page.getByText(/Mesma placa em outro cadastro/)).toBeVisible();

  // Edição
  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByLabel("Cor").fill("VERMELHA");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas")).toBeVisible();
  await expect(page.getByText("VERMELHA").first()).toBeVisible();

  // Arquivar e restaurar
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page.getByRole("button", { name: "Arquivar veículo" }).click();
  await expect(page.getByText("Arquivado").first()).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByRole("button", { name: "Arquivar", exact: true })).toBeVisible();
});

test("documentos: anexar PDF e imagem, visualizar, baixar, recusar falso, substituir e excluir", async ({ page }) => {
  await login(page, "admin");
  await openVehicle(page, "QVG5838");
  await expect(page.getByText("Sem documentos")).toBeVisible();

  // PDF
  await page.getByRole("button", { name: /Guarde o primeiro documento/ }).click();
  const sheet = page.getByRole("dialog", { name: "Adicionar documento" });
  await sheet.locator('input[accept^="application/pdf"]').setInputFiles({ name: "crlv.pdf", mimeType: "application/pdf", buffer: pdfBuffer() });
  await sheet.getByRole("radio", { name: "CRLV" }).click();
  await expect(sheet.getByLabel("Nome")).toHaveValue("CRLV");
  await sheet.getByLabel("Data (opcional)").fill("2026-03-12");
  await sheet.getByRole("button", { name: "Salvar documento" }).click();
  await expect(page.getByText("Documento salvo")).toBeVisible();
  await expect(page.getByText("1 documento")).toBeVisible();

  // Arquivo guardado cifrado (nenhum bloco contém o PDF em claro)
  const root = path.join(__dirname, "..", "..", ".storage-e2e", "docs");
  const blobs = readdirSync(root, { recursive: true }).map(String).filter((f) => statSync(path.join(root, f)).isFile());
  expect(blobs.length).toBeGreaterThan(0);
  for (const f of blobs) expect(readFileSync(path.join(root, f)).includes("%PDF")).toBe(false);

  // Visualizar: link assinado, conteúdo decifrado, sem cache
  const contentResp = page.waitForResponse((r) => r.url().includes("/content?"));
  await page.getByRole("button", { name: /^CRLV/ }).click();
  const r = await contentResp;
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("application/pdf");
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect((await (await page.request.get(r.url())).body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Download
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar" }).click();
  expect((await dl).suggestedFilename()).toBe("CRLV.pdf");
  await page.keyboard.press("Escape");

  // Imagem
  await page.getByRole("button", { name: "Adicionar" }).click();
  await sheet.locator('input[accept^="application/pdf"]').setInputFiles({ name: "vistoria.png", mimeType: "image/png", buffer: pngBuffer() });
  await sheet.getByRole("radio", { name: "Vistoria" }).click();
  await sheet.getByRole("button", { name: "Salvar documento" }).click();
  await expect(page.getByText("2 documentos")).toBeVisible();

  // Arquivo falso (texto com extensão .pdf) é recusado antes do envio
  await page.getByRole("button", { name: "Adicionar" }).click();
  await sheet.locator('input[accept^="application/pdf"]').setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>oi</html>") });
  await expect(sheet.getByRole("alert")).toContainText("Formato não aceito");
  await page.keyboard.press("Escape");

  // Substituir
  await page.getByRole("button", { name: "Substituir CRLV" }).click();
  const rep = page.getByRole("dialog", { name: "Substituir documento" });
  await rep.locator('input[accept^="application/pdf"]').setInputFiles({ name: "crlv2.pdf", mimeType: "application/pdf", buffer: pdfBuffer("v2") });
  await rep.getByRole("button", { name: "Substituir documento" }).click();
  await expect(page.getByText("Documento substituído")).toBeVisible();
  await expect(page.getByText("2 documentos")).toBeVisible();

  // Excluir com confirmação
  await page.getByRole("button", { name: /^Excluir Vistoria/ }).click();
  await page.getByRole("button", { name: "Excluir documento" }).click();
  await expect(page.getByText("Documento excluído")).toBeVisible();
  await expect(page.getByText("1 documento")).toBeVisible();
});

test("upload real em blocos com progresso (arquivo de 7 MB)", async ({ page }) => {
  await login(page, "admin");
  await openVehicle(page, "QDA6102");
  await page.getByRole("button", { name: /Guarde o primeiro documento/ }).click();
  const sheet = page.getByRole("dialog", { name: "Adicionar documento" });
  const big = Buffer.concat([pdfBuffer(), Buffer.alloc(7 * 1024 * 1024, 32)]);
  await sheet.locator('input[accept^="application/pdf"]').setInputFiles({ name: "seguro.pdf", mimeType: "application/pdf", buffer: big });
  await sheet.getByRole("radio", { name: "Seguro" }).click();
  const chunks: string[] = [];
  page.on("request", (rq) => rq.method() === "PUT" && chunks.push(rq.url()));
  await sheet.getByRole("button", { name: "Salvar documento" }).click();
  await expect(page.getByText("Documento salvo")).toBeVisible({ timeout: 30_000 });
  expect(chunks.length).toBe(3);
});
