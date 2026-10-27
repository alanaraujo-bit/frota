export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="skeleton h-10 w-48" />
      <div className="skeleton h-5 w-72" />
      <div className="skeleton mt-8 h-40 w-full" />
      <div className="skeleton h-64 w-full" />
    </div>
  );
}
