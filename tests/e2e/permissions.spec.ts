import { expect, test } from "@playwright/test";
import { login, openVehicle } from "./helpers";

test("sem sessão: páginas redirecionam e API responde 401", async ({ page, request }) => {
  await page.goto("/veiculos");
  await expect(page).toHaveURL(/\/entrar/);
  expect((await request.get("/api/search-index")).status()).toBe(401);
});

test("leitura: consulta, mas não altera nada (UI e servidor)", async ({ page }) => {
  await login(page, "reader");
  await page.getByRole("combobox", { name: /Buscar por placa/ }).fill("zzz9z99");
  await expect(page.getByText(/Nada encontrado/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Cadastrar veículo/ })).toHaveCount(0);

  await openVehicle(page, "QVG5838");
  await expect(page.getByLabel(/^Placa QVG-5838$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Substituir|Excluir/ })).toHaveCount(0);
  const vehicleId = page.url().split("/").pop()!;

  // Leitura pode ver o documento anexado no teste anterior
  const doc = page.getByRole("button", { name: /^CRLV/ });
  if (await doc.count()) {
    const resp = page.waitForResponse((r) => r.url().includes("/content?"));
    await doc.click();
    expect((await resp).status()).toBe(200);
  }

  await page.goto("/veiculos/novo");
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await page.goto("/usuarios");
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();

  // Mutação direta na API, mesma origem, com sessão de leitura
  const status = await page.evaluate(async (id) => {
    const r = await fetch(`/api/vehicles/${id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CRLV", title: "x", fileName: "x.pdf", mime: "application/pdf", size: 10 }),
    });
    return r.status;
  }, vehicleId);
  expect(status).toBe(403);
});

test("link de documento: exige assinatura válida do próprio usuário", async ({ page, browser }) => {
  await login(page, "admin");
  await openVehicle(page, "QVG5838");
  const docBtn = page.getByRole("button", { name: /^CRLV/ });
  await expect(docBtn).toBeVisible();
  const resp = page.waitForResponse((r) => /\/api\/documents\/[0-9a-f-]{36}$/.test(r.url().split("?")[0]) && r.request().method() === "GET");
  await docBtn.click();
  const { url } = await (await resp).json();
  const docPath = url.split("?")[0];

  // Sem assinatura / assinatura alterada
  expect((await page.request.get(docPath)).status()).toBe(403);
  expect((await page.request.get(url.replace(/sig=[^&]+/, "sig=AAAA"))).status()).toBe(403);
  // Assinatura válida do admin, usada por outro usuário (leitura): recusada
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2, "reader");
  expect((await p2.request.get(url)).status()).toBe(403);
  // Sem sessão: 401
  const anon = await browser.newContext();
  expect((await anon.request.get(`http://localhost:3200${url}`)).status()).toBe(401);
  await other.close();
  await anon.close();
});

test("CSRF: mutação vinda de outra origem é recusada", async ({ page }) => {
  await login(page, "admin");
  const r = await page.request.post("/api/vehicles/00000000-0000-0000-0000-000000000000/documents", {
    headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    data: {},
  });
  expect(r.status()).toBe(403);
});
