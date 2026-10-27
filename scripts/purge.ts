// Limpeza: apaga do armazenamento os blocos de documentos excluídos há mais de 30 dias
// e de envios abandonados há mais de 24 h. O registro no banco e a auditoria permanecem.
// Uso: npm run purge   (agende diariamente; rode `npm run backup` antes)
import { appStore, db, run } from "./lib";

run(async () => {
  const store = appStore();
  const day = 86_400_000;
  const docs = await db.document.findMany({
    where: {
      purgedAt: null,
      OR: [
        { deletedAt: { lt: new Date(Date.now() - 30 * day) } },
        { status: "PENDENTE", createdAt: { lt: new Date(Date.now() - day) } },
      ],
    },
    select: { id: true },
  });
  for (const d of docs) {
    await store.deletePrefix(`docs/${d.id}/`);
    await db.document.update({ where: { id: d.id }, data: { purgedAt: new Date(), deletedAt: new Date() } });
  }
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * day) } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log(`Limpeza: ${docs.length} documento(s) removido(s) do armazenamento.`);
});
