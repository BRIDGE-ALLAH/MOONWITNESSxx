import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function RIOTRadar() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">Opportunity Radar</h1>
            <Badge variant="outline">Not connected to live data</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Evidence-led opportunity evaluation
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No persisted opportunities yet</CardTitle>
            <CardDescription>
              This workspace does not currently have a production opportunity API or an authenticated
              operator data boundary. No opportunity records are available to display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              Earlier sample cards on this page contained unsupported market-size, growth, pricing,
              confidence, and unit-economics claims. They have been removed rather than presented
              as observed demand or business results.
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">What a real record will require</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>A buyer problem and intended job-to-be-done.</li>
                <li>Source URLs, observation dates, evidence classes, and provenance.</li>
                <li>Explicit separation of observed facts, estimates, and hypotheses.</li>
                <li>Confidence with a documented method, not an arbitrary percentage.</li>
                <li>Hard-gate status and an auditable operator decision.</li>
              </ul>
            </div>
            <p className="border-t border-acid-lime/20 pt-4">
              Opportunity capture, review, promotion, and persistence are tracked as the next real
              commerce workflow. Until those services and authorization checks exist, this page
              intentionally offers no create, approve, or reject controls.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
