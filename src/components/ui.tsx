import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { displayPlate, plateFormat } from "@/lib/plate";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const sizes = { md: "h-11 px-4 text-[15px]", sm: "h-9 px-3 text-sm", lg: "h-12 px-5 text-base" };
const variants = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(20_22_27/0.2)]",
  accent: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-ink ring-1 ring-line-strong hover:bg-surface-2 hover:ring-ink/30",
  ghost: "text-ink-2 hover:bg-ink/[0.05]",
  danger: "bg-danger text-white hover:brightness-110",
};

type BtnOpts = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & BtnOpts) {
  return <button className={cx(buttonBase, sizes[size], variants[variant], className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & BtnOpts) {
  return <Link className={cx(buttonBase, sizes[size], variants[variant], className)} {...p} />;
}

export const inputClass =
  "block w-full min-w-0 rounded-xl border-0 bg-surface px-3.5 text-[16px] text-ink ring-1 ring-line-strong placeholder:text-muted/70 transition-shadow focus:outline-none focus:ring-2 focus:ring-accent md:text-[15px]";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputClass, "h-11", className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23666c79%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z%22/></svg>')] bg-[length:18px] bg-[right_12px_center] bg-no-repeat pr-10", className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-24 py-2.5", className)} {...p} />;
}

const tones = {
  neutral: "bg-ink/[0.06] text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Situação legada da planilha: só um rótulo, nunca um cálculo. */
export function LegacyStatus({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-muted">—</span>;
  const tone = value === "OK" ? "ok" : value === "ATRASADO" ? "danger" : value === "PENDENTE" ? "warn" : "neutral";
  return <Badge tone={tone}>{value}</Badge>;
}

/** Placa com aparência física: Mercosul (faixa azul), antiga (cinza) ou inválida (tracejada, para revisão). */
export function Plate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "xl" }) {
  const fmt = plateFormat(plate);
  const text = displayPlate(plate);
  const s = {
    sm: { box: "min-w-[86px] rounded-[5px] text-[13px]", band: "h-[5px]", pad: "px-1.5 py-[2px]" },
    md: { box: "min-w-[104px] rounded-md text-[15px]", band: "h-[6px]", pad: "px-2 py-[3px]" },
    xl: { box: "min-w-[220px] rounded-xl text-[34px] md:text-[42px]", band: "h-[14px] md:h-[16px]", pad: "px-4 py-1.5" },
  }[size];
  return (
    <span
      aria-label={`Placa ${text}${fmt === "invalida" ? ", formato fora do padrão" : ""}`}
      className={cx(
        "inline-flex flex-col overflow-hidden text-center font-mono font-bold leading-none tracking-[0.06em] text-ink",
        s.box,
        fmt === "mercosul" && "bg-white ring-[1.5px] ring-ink/80",
        fmt === "antiga" && "bg-[#e9e9e6] ring-[1.5px] ring-ink/70",
        fmt === "invalida" && "bg-warn-soft text-warn outline-dashed outline-[1.5px] outline-warn",
      )}
    >
      {fmt === "mercosul" && (
        <span className={cx("flex items-center justify-center bg-plate-blue", s.band)}>
          {size === "xl" && <span className="font-sans text-[9px] font-semibold tracking-[0.3em] text-white/90 md:text-[10px]">BRASIL</span>}
        </span>
      )}
      <span className={cx("tabular", s.pad)}>{text}</span>
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="fade-in flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-ink/[0.05] text-ink-2">{icon}</div>}
      <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, eyebrow, actions, children }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl bg-surface ring-1 ring-line", className)} {...p} />;
}
