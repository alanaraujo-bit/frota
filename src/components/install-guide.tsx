"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckIcon } from "./icons";
import { Button, Card, cx } from "./ui";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "desktop";

function ShareGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="ícone Compartilhar" className="inline -mt-1">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-[15px]">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(ua) ? "android" : "desktop";
}

const noopSubscribe = () => () => {};
function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function InstallGuide() {
  // Snapshot do servidor = "desktop"/não instalado; o cliente corrige sem erro de hidratação.
  const platform = useSyncExternalStore(noopSubscribe, detectPlatform, () => "desktop" as Platform);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
  const [justInstalled, setInstalled] = useState(false);
  const installed = standalone || justInstalled;
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [tab, setTab] = useState<Platform | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const shown = tab ?? platform;

  if (installed)
    return (
      <Card className="flex items-center gap-4 p-6">
        <span className="pop grid size-12 place-items-center rounded-full bg-ok text-white">
          <CheckIcon size={24} />
        </span>
        <div>
          <p className="text-[16px] font-semibold">App instalado</p>
          <p className="text-sm text-muted">Você já está usando o FROTA como aplicativo.</p>
        </div>
      </Card>
    );

  return (
    <div className="space-y-5">
      {prompt && (
        <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[16px] font-semibold">Instalar com um toque</p>
            <p className="text-sm text-muted">Este navegador permite instalar direto. O ícone aparece junto dos seus apps.</p>
          </div>
          <Button
            variant="accent"
            size="lg"
            onClick={async () => {
              await prompt.prompt();
              const c = await prompt.userChoice;
              if (c.outcome === "accepted") setInstalled(true);
              setPrompt(null);
            }}
          >
            Instalar FROTA
          </Button>
        </Card>
      )}

      <div role="tablist" aria-label="Aparelho" className="inline-flex rounded-xl bg-ink/[0.06] p-1">
        {(["ios", "android", "desktop"] as Platform[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={shown === p}
            onClick={() => setTab(p)}
            className={cx("rounded-lg px-4 py-2 text-sm font-medium transition", shown === p ? "bg-surface text-ink shadow-sm" : "text-muted")}
          >
            {p === "ios" ? "iPhone" : p === "android" ? "Android" : "Computador"}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {shown === "ios" && (
          <Steps
            items={[
              <>Abra este endereço no <strong>Safari</strong> (no iPhone, outros navegadores podem não oferecer a opção).</>,
              <>
                Toque em <strong>Compartilhar</strong> <ShareGlyph /> na barra inferior.
              </>,
              <>
                Role e toque em <strong>Adicionar à Tela de Início</strong>.
              </>,
              <>
                Confirme em <strong>Adicionar</strong>. O FROTA abre em tela cheia, como um app.
              </>,
            ]}
          />
        )}
        {shown === "android" && (
          <Steps
            items={[
              <>Abra este endereço no <strong>Chrome</strong>.</>,
              <>
                Toque no menu <strong>⋮</strong> no canto superior direito.
              </>,
              <>
                Escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).
              </>,
              <>Confirme. O ícone do FROTA aparece na gaveta de apps.</>,
            ]}
          />
        )}
        {shown === "desktop" && (
          <Steps
            items={[
              <>Use Chrome ou Edge.</>,
              <>
                Clique no ícone de instalação na barra de endereço (monitor com seta) ou no menu <strong>⋮ → Instalar FROTA</strong>.
              </>,
              <>O FROTA abre em janela própria. Atalho de busca: Ctrl+K.</>,
            ]}
          />
        )}
      </Card>
      <p className="text-xs text-muted">
        A instalação exige endereço com HTTPS. Por segurança, nenhum dado ou documento fica guardado no aparelho: sem internet, o app mostra um aviso e volta assim que a
        conexão retorna.
      </p>
    </div>
  );
}
