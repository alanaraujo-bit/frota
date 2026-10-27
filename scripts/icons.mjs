// Gera os ícones raster a partir de public/icons/icon.svg. Uso: npm run icons
import sharp from "sharp";
import { readFileSync } from "node:fs";

const dir = new URL("../public/icons/", import.meta.url);
const svg = readFileSync(new URL("icon.svg", dir), "utf8");
// Maskable/Apple: fundo cheio (sem cantos arredondados) e marca dentro da zona segura de 80%.
const full = svg
  .replaceAll(' rx="112"', "")
  .replace('<g id="mark">', '<g id="mark" transform="translate(256 256) scale(0.82) translate(-256 -256)">');

const out = async (src, size, name) =>
  sharp(Buffer.from(src), { density: 384 }).resize(size, size).png().toFile(new URL(name, dir).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

await out(svg, 192, "icon-192.png");
await out(svg, 512, "icon-512.png");
await out(full, 192, "maskable-192.png");
await out(full, 512, "maskable-512.png");
await out(full, 180, "apple-touch-icon.png");
await out(svg, 32, "favicon-32.png");
// Telas de abertura do iOS: fundo da marca com o ícone centralizado.
import { mkdirSync } from "node:fs";
const splashDir = new URL("../public/splash/", import.meta.url);
mkdirSync(splashDir, { recursive: true });
const sizes = [[1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532], [1125, 2436], [1242, 2688], [828, 1792], [750, 1334]];
for (const [w, h] of sizes) {
  const icon = await sharp(Buffer.from(svg), { density: 384 }).resize(Math.round(w * 0.24)).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: "#f4f4f1" } })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toFile(new URL(`splash-${w}x${h}.png`, splashDir).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}
console.log("ícones e telas de abertura gerados");
