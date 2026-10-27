// Service worker servido por rota para levar a versão do deploy (atualização segura).
// Regras: nunca cacheia navegação autenticada, API ou documentos. Só o shell offline e assets estáticos com hash.

const VERSION =
  process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_VERSION ?? "dev";

const source = `
const VERSION = ${JSON.stringify(VERSION)};
const SHELL = "frota-shell-" + VERSION;
const STATIC = "frota-static";
const SHELL_URLS = ["/offline", "/icons/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("frota-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Sempre rede; sem rede, tela offline. Páginas autenticadas nunca entram no cache.
    event.respondWith(fetch(req).catch(() => caches.match("/offline", { cacheName: SHELL })));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(req, { cacheName: SHELL }).then((hit) => hit || fetch(req)));
  }
});
`;

export function GET() {
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
