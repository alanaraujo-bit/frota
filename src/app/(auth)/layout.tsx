import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-[calc(24px+var(--safe-bottom))] pt-[calc(24px+var(--safe-top))]">
      <div className="mx-auto w-full max-w-[400px]">
        <Logo />
      </div>
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      <p className="mx-auto max-w-[400px] text-center text-xs text-muted">Acesso restrito. Cadastro somente por convite.</p>
    </main>
  );
}
