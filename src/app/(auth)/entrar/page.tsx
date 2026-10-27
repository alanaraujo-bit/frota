import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <div className="fade-in">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Entrar</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">Consulte placas, fichas e documentos da frota.</p>
      <LoginForm next={typeof next === "string" ? next : "/"} />
    </div>
  );
}
