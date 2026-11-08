import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  HalftoneSurface,
  SkinRoot,
} from '@riotworks/ui'

function ObservatorySpecimen() {
  return (
    <SkinRoot
      skin="observatory"
      mode="dark"
      density="comfortable"
      className="h-full min-h-[34rem] rounded-lg border border-border p-5 md:p-7"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">01 / The Instrument</p>
          <p className="mt-1 font-display text-sm font-semibold uppercase tracking-wider">MOONWITNESS Observatory</p>
        </div>
        <Badge variant="outline">SPECIMEN</Badge>
      </div>

      <div className="py-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Observe · Record · Verify</p>
        <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">Observe the signal.</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          A measured workspace for live context, traceable observations, and decisions that preserve uncertainty.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card id="observatory-evidence" className="border-border bg-card shadow-none">
          <CardHeader className="space-y-2 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Observation / 001</p>
            <CardTitle className="text-lg">Signal detected</CardTitle>
            <CardDescription>Example state — not connected to a live source.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between p-4 pt-0">
            <span className="font-mono text-xs text-muted-foreground">SOURCE UNKNOWN</span>
            <Badge variant="outline">UNVERIFIED</Badge>
          </CardContent>
        </Card>
        <div className="flex flex-col justify-between gap-4 border border-border bg-secondary/40 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Evidence trail</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">03</p>
            <p className="text-xs text-muted-foreground">Illustrative records</p>
          </div>
          <Button asChild className="w-full" size="sm"><a href="#observatory-evidence">Review observation</a></Button>
        </div>
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dark-first · Instrument grid · Comfortable density</p>
    </SkinRoot>
  )
}

function ArchiveSpecimen() {
  return (
    <SkinRoot
      skin="archive"
      mode="light"
      density="comfortable"
      className="h-full min-h-[34rem] rounded-lg border border-border p-5 md:p-7"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">02 / The Record</p>
          <p className="mt-1 font-display text-sm font-semibold uppercase tracking-wider">MOONWITNESS Archive</p>
        </div>
        <Badge variant="outline">FIELD NOTE</Badge>
      </div>

      <article className="py-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Record 002 · Source context</p>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">A message, with its source.</h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
          An observation becomes useful when its date, origin, author, and limits remain attached to the story.
        </p>
      </article>

      <Card id="archive-record" className="rounded-none border-x-0 border-b-0 border-t-2 border-border bg-transparent shadow-none">
        <CardHeader className="px-0 pb-3 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Provenance / Example</p>
          <CardTitle className="text-lg">Source notes</CardTitle>
          <CardDescription>Editorial hierarchy keeps evidence near the statement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-0 pb-0">
          <div className="flex justify-between gap-4 border-b border-border pb-2 text-sm">
            <span className="text-muted-foreground">Origin</span><span className="font-medium">Sample archive</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2 text-sm">
            <span className="text-muted-foreground">Recorded</span><span className="font-mono text-xs">2026-11-08</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Evidence status</span><Badge variant="outline">UNVERIFIED</Badge>
          </div>
        </CardContent>
      </Card>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Light-first · Warm paper · Reading rhythm</p>
    </SkinRoot>
  )
}

function SignalSpecimen() {
  return (
    <SkinRoot
      skin="signal"
      mode="dark"
      density="comfortable"
      className="relative h-full min-h-[34rem] overflow-hidden rounded-lg border border-border p-5 md:p-7"
    >
      <div className="absolute right-5 top-5 select-none font-mono text-[10px] tracking-[0.2em] text-muted-foreground" aria-hidden="true">MW / 003</div>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4 pr-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">03 / The Message</p>
            <p className="mt-1 font-display text-sm font-semibold uppercase tracking-wider">MOONWITNESS Signal</p>
          </div>
          <Badge variant="outline" className="border-transparent bg-accent text-accent-foreground">EDITORIAL</Badge>
        </div>

        <HalftoneSurface textureOpacity={0.045} className="my-4 border-y border-border px-3 py-7 md:px-5">
          <div id="signal-story" className="flex flex-1 flex-col justify-center py-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Noise / Signal / Meaning</p>
            <h2 className="mt-5 max-w-lg text-4xl font-black leading-[0.9] tracking-tight md:text-6xl">When the Moon rises.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
              We share messages. Keep the source. Keep the context. Never mistake volume for truth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild><a href="#signal-story">Explore the story</a></Button>
              <Button asChild variant="outline"><a href="#archive-record">Read the record</a></Button>
            </div>
          </div>
        </HalftoneSurface>

        <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Print grain</span><span>Halftone</span><span>Editorial cut</span>
        </div>
      </div>
    </SkinRoot>
  )
}

export default function SkinSystemLabPage() {
  return (
    <main className="space-y-8 p-4 md:p-8">
      <header className="max-w-3xl space-y-3">
        <Badge variant="outline">INTERNAL DESIGN SPECIMEN · NOT PRODUCTION DATA</Badge>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">MOONWITNESS / UI LAB</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Three experiences. One witness.</h1>
        <p className="text-sm leading-7 text-muted-foreground md:text-base">
          This page compares the initial Skin Engine profiles. The same product identity and evidence language
          are expressed through an instrument, an archive, and an editorial signal.
        </p>
      </header>

      <section aria-label="MOONWITNESS skin specimens" className="grid items-stretch gap-5 xl:grid-cols-3">
        <ObservatorySpecimen />
        <ArchiveSpecimen />
        <SignalSpecimen />
      </section>

      <footer className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
        These are design specimens with illustrative content only. No live source, account, operational status,
        financial information, or evidence record is connected to this workbench.
      </footer>
    </main>
  )
}
