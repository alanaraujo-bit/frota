import { AppNav } from "@/components/app-nav";
import { CommandPalette } from "@/components/search";
import { Toaster } from "@/components/toast";
import { Flash } from "@/components/flash";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <>
      <AppNav isAdmin={isAdmin} name={user.name} />
      <main className="mx-auto w-full max-w-[1440px] pb-[calc(var(--tabbar-space)+20px)] pl-[max(16px,var(--safe-left))] pr-[max(16px,var(--safe-right))] pt-5 md:pb-16 md:pl-8 md:pr-8 md:pt-10 xl:pl-12 xl:pr-12">{children}</main>
      <CommandPalette isAdmin={isAdmin} />
      <Toaster />
      <Suspense>
        <Flash />
      </Suspense>
    </>
  );
}
