import { Screen } from "@/components/screen";
import type { Metadata } from "next";
import { createVehicle } from "@/app/actions/vehicles";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { requireAdmin } from "@/lib/auth/dal";
import { getGroups } from "@/lib/data";
import { plateKey } from "@/lib/plate";

export const metadata: Metadata = { title: "Cadastrar veículo" };

export default async function NewVehiclePage({ searchParams }: PageProps<"/veiculos/novo">) {
  await requireAdmin();
  const [{ placa }, groups] = await Promise.all([searchParams, getGroups()]);
  return (
    <Screen className="mx-auto max-w-6xl">
      <PageHeader title="Cadastrar veículo" eyebrow="Novo">
        <p className="mt-1.5 text-[15px] text-muted">Só placa e grupo são obrigatórios. O resto pode ser completado depois.</p>
      </PageHeader>
      <VehicleForm
        action={createVehicle}
        groups={groups}
        cancelHref="/veiculos"
        submitLabel="Cadastrar veículo"
        initial={{
          plate: typeof placa === "string" ? plateKey(placa).slice(0, 10) : "",
          groupId: groups.length === 1 ? groups[0].id : "",
          makeModel: "",
          renavam: "",
          chassis: "",
          year: "",
          color: "",
          sheetReference: "",
          inspection: "",
          legacyStatus: "",
          notes: "",
          contacts: [],
        }}
      />
    </Screen>
  );
}
