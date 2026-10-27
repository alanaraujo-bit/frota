import { expect, test } from "@playwright/test";
import { login, noHorizontalScroll, openVehicle } from "./helpers";

test("manifesto instalável e ícones", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ name: "FROTA", display: "standalone", start_url: "/", scope: "/" });
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:maskable", "512x512:maskable", "192x192:any", "512x512:any"]));
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  expect((await request.get("/icons/apple-touch-icon.png")).headers()["content-type"]).toBe("image/png");
});

test("service worker: controla a página, mostra tela offline e não guarda dados autenticados", async ({ page, context }) => {
  await login(page, "admin");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await openVehicle(page, "QVG5838");
  await expect(page.getByLabel(/^Placa QVG-5838$/)).toBeVisible();

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(cached).toContain("/offline");
  expect(cached.filter((u) => u.startsWith("/api") || u.startsWith("/veiculos") || u === "/")).toEqual([]);

  await context.setOffline(true);
  await page.goto("/veiculos").catch(() => {});
  await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
  await context.setOffline(false);
});

test("página de instalação com instruções Android e iPhone", async ({ page }) => {
  await login(page, "reader");
  await page.goto("/instalar");
  await page.getByRole("tab", { name: "iPhone" }).click();
  await expect(page.getByText("Adicionar à Tela de Início")).toBeVisible();
  await page.getByRole("tab", { name: "Android" }).click();
  await expect(page.getByText("Instalar app")).toBeVisible();
});

for (const width of [360, 768, 1280]) {
  test(`layout em ${width}px: sem rolagem horizontal e ações visíveis`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await login(page, "admin");
    await noHorizontalScroll(page);

    await page.goto("/veiculos");
    await expect(page.getByRole("heading", { name: "Veículos" })).toBeVisible();
    await noHorizontalScroll(page);
    await expect(page.getByRole("link", { name: /Cadastrar/ }).first()).toBeInViewport();

    await page.goto("/");
    await openVehicle(page, "TUY3H25");
    await expect(page.getByLabel(/^Placa TUY3H25$/)).toBeVisible();
    await noHorizontalScroll(page);
    await expect(page.getByRole("link", { name: "Editar" })).toBeInViewport();
    const add = page.getByRole("button", { name: /Guarde o primeiro documento|Adicionar/ }).first();
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport();

    await page.goto("/veiculos/novo");
    await noHorizontalScroll(page);
    const save = page.getByRole("button", { name: "Cadastrar veículo" });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();

    if (width < 768) {
      const nav = page.getByRole("navigation", { name: "Navegação inferior" });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "Conta" })).toBeInViewport();
    }
  });
}

test("comportamento de app nativo no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "reader");
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).toContain("viewport-fit=cover");
  expect(meta).toContain("maximum-scale=1");
  const css = await page.evaluate(() => ({
    touch: getComputedStyle(document.documentElement).touchAction,
    overscroll: getComputedStyle(document.body).overscrollBehaviorY,
  }));
  expect(css).toEqual({ touch: "manipulation", overscroll: "none" });
  // Tab bar flutuante dentro da tela e sem cobrir o conteúdo final.
  const bar = page.getByRole("navigation", { name: "Navegação inferior" });
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844 - 8);
  await page.getByRole("button", { name: "Buscar veículo" }).click();
  await expect(page.getByRole("dialog", { name: "Buscar veículo" }).getByRole("combobox")).toBeFocused();
});
