import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateVehicle } from "@/app/actions/vehicles";
import { PageHeader, Plate } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { requireAdmin } from "@/lib/auth/dal";
import { getGroups, type Contact } from "@/lib/data";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Editar veículo" };

export default async function EditVehiclePage({ params }: PageProps<"/veiculos/[id]/editar">) {
  await requireAdmin();
  const { id } = await params;
  const v = await db.vehicle.findUnique({ where: { id } }).catch(() => null);
  if (!v) notFound();
  const groups = await getGroups();
  if (!groups.some((g) => g.id === v.groupId)) {
    const g = await db.group.findUniqueOrThrow({ where: { id: v.groupId } });
    groups.push({ ...g, _count: { vehicles: 0 } });
  }
  return (
    <Screen className="mx-auto max-w-6xl">
      <PageHeader title="Editar veículo" eyebrow={<Plate plate={v.plate} size="sm" />} />
      <VehicleForm
        action={updateVehicle.bind(null, v.id)}
        groups={groups}
        cancelHref={`/veiculos/${v.id}`}
        submitLabel="Salvar alterações"
        initial={{
          plate: v.plate,
          groupId: v.groupId,
          makeModel: v.makeModel ?? "",
          renavam: v.renavam ?? "",
          chassis: v.chassis ?? "",
          year: v.year ?? "",
          color: v.color ?? "",
          sheetReference: v.sheetReference ?? "",
          inspection: v.inspection ?? "",
          legacyStatus: v.legacyStatus ?? "",
          notes: v.notes ?? "",
          contacts: (v.contacts as Contact[]) ?? [],
        }}
      />
    </Screen>
  );
}
