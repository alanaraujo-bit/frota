import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#14161b" />
      <rect x="72" y="166" width="368" height="180" rx="28" fill="#fff" />
      <path d="M100 166h312a28 28 0 0 1 28 28v10H72v-10a28 28 0 0 1 28-28z" fill="#0b5a53" />
      <path d="M214 218h94v28h-60v22h52v27h-52v39h-34z" fill="#14161b" />
      <rect x="316" y="310" width="24" height="24" rx="6" fill="#0b5a53" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[0.18em]">{BRAND.name}</span>
    </span>
  );
}
