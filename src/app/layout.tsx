import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Telas de abertura do iOS (geradas por `npm run icons`).
const SPLASH = [
  [1290, 2796, 3],
  [1179, 2556, 3],
  [1284, 2778, 3],
  [1170, 2532, 3],
  [1125, 2436, 3],
  [1242, 2688, 3],
  [828, 1792, 2],
  [750, 1334, 2],
].map(([w, h, r]) => ({
  url: `/splash/splash-${w}x${h}.png`,
  media: `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default", startupImage: SPLASH },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.themeColor },
    { media: "(prefers-color-scheme: dark)", color: BRAND.themeColorDark },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Sem zoom acidental (pinça/foco em campo). Leitores de tela e o "forçar zoom" de acessibilidade continuam funcionando.
  maximumScale: 1,
  userScalable: false,
  // Ocupa a tela toda; as áreas do sistema (notch, relógio, barra de gestos) são respeitadas via env(safe-area-inset-*).
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <div className="ambient" aria-hidden="true" />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
