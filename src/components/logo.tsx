import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 28 }: { size?: number }) {
  // Mesmo arquivo do ícone do app; <img> evita ids de gradiente duplicados no DOM.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/icon.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.18em]">{BRAND.name}</span>
    </span>
  );
}
