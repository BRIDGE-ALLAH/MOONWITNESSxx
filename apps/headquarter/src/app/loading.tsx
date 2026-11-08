export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading Headquarter module"
      className="min-h-[60vh] space-y-6 bg-background p-6 text-foreground md:p-8"
    >
      <div className="h-3 w-28 animate-pulse bg-muted" />
      <div className="h-10 w-2/3 max-w-xl animate-pulse bg-muted" />
      <div className="h-4 w-full max-w-2xl animate-pulse bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse border border-border bg-card" />
        ))}
      </div>
      <span className="sr-only">Loading content…</span>
    </main>
  )
}
