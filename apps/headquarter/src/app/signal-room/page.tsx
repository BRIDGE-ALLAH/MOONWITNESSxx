import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function SignalRoom() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">Read the Signal</h1>
            <Badge variant="outline">Live sources not connected</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            RIOTWORKS market intelligence
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No verified market signals yet</CardTitle>
            <CardDescription>
              This page is not connected to a live market-data or evidence-source service. There are
              no verified trends, category counts, buyer-problem prevalence measurements, or
              marketplace observations available to display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              The previous screen used static examples and unsupported confidence percentages,
              source-verification labels, and affected-user estimates. Those values have been removed
              rather than presented as current market intelligence.
            </p>

            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">
                Evidence required for a real signal
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Canonical source URL and source identity.</li>
                <li>Publication time when known, plus the time the evidence was captured.</li>
                <li>Evidence class that separates observed facts, anecdotes, inferences, and hypotheses.</li>
                <li>Collection method, permission basis, reliability, and known limitations.</li>
                <li>Recheck date and provenance for signals that can become stale.</li>
              </ul>
            </div>

            <p className="border-t border-acid-lime/20 pt-4">
              Market discovery and opportunity evaluation will appear here only after their source
              records, freshness rules, and backend contracts are connected. Until then, this page
              intentionally shows an honest empty state instead of invented analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
