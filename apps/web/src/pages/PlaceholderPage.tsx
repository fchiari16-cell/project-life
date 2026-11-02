/** Explicitly labelled empty section: no fake data, no inert controls. */
export function PlaceholderPage({ title, description, milestone }: { title: string; description: string; milestone: string }) {
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">{title}</h1>
      <section className="rounded-xl border border-dashed border-border bg-card p-6">
        <p>{description}</p>
        <p className="mt-3 text-sm font-semibold text-muted-foreground">Disponibile dalla milestone {milestone}</p>
      </section>
    </>
  );
}
