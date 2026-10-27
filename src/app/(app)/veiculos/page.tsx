import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { ButtonLink, PageHeader } from "@/components/ui";
import { VehicleList, type ListItem } from "@/components/vehicle-list";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Veículos" };

export default async function VehiclesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [vehicles, groups] = await Promise.all([
    db.vehicle.findMany({
      where: isAdmin ? {} : { archivedAt: null },
      orderBy: [{ group: { sortOrder: "asc" } }, { sheetOrder: "asc" }, { plate: "asc" }],
      select: {
        id: true,
        plate: true,
        renavam: true,
        chassis: true,
        makeModel: true,
        year: true,
        legacyStatus: true,
        inspection: true,
        archivedAt: true,
        plateNeedsReview: true,
        group: { select: { id: true, name: true } },
        _count: { select: { documents: { where: { status: "PRONTO", deletedAt: null } } } },
      },
    }),
    db.group.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { vehicles: { where: { archivedAt: null } } } } },
    }),
  ]);

  const items: ListItem[] = vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    renavam: v.renavam,
    chassis: v.chassis,
    makeModel: v.makeModel,
    year: v.year,
    legacyStatus: v.legacyStatus,
    inspection: v.inspection,
    group: v.group.name,
    groupId: v.group.id,
    archived: !!v.archivedAt,
    needsReview: v.plateNeedsReview,
    docs: v._count.documents,
  }));

  return (
    <Screen>
      <PageHeader
        title="Veículos"
        actions={
          isAdmin && (
            <ButtonLink href="/veiculos/novo" variant="accent">
              <PlusIcon size={18} /> Cadastrar
            </ButtonLink>
          )
        }
      />
      <Suspense>
        <VehicleList items={items} groups={groups.map((g) => ({ id: g.id, name: g.name, count: g._count.vehicles }))} isAdmin={isAdmin} />
      </Suspense>
    </Screen>
  );
}
