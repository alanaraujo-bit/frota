import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import { GroupsManager } from "@/components/groups-manager";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { getGroups } from "@/lib/data";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  await requireAdmin();
  const groups = await getGroups(true);
  return (
    <Screen className="mx-auto max-w-5xl">
      <PageHeader title="Grupos e titulares">
        <p className="mt-1.5 text-[15px] text-muted">Todos ficam no mesmo espaço de trabalho. O grupo só organiza os veículos por titular.</p>
      </PageHeader>
      <GroupsManager
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          document: g.document,
          documentType: g.documentType,
          count: g._count.vehicles,
          archived: !!g.archivedAt,
          imported: !!g.sourceKey,
        }))}
      />
    </Screen>
  );
}
