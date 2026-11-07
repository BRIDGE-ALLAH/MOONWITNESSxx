import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function SignalRoom() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">Signal Room</h1>
            <Badge variant="outline">Not connected to live sources</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Market intelligence and source evidence
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No verified market observations available</CardTitle>
            <CardDescription>
              This page has no connected source-ingestion or evidence-search service. It will not
              display synthetic trend percentages, category counts, buyer-problem prevalence, or
              marketplace movements as if they were observed market data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              Previous sample content included unsupported confidence scores, affected-buyer
              percentages, source verification labels, and trend claims. Those values have been
              removed because they were not backed by retrievable, dated source records.
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">Evidence required before a signal is shown</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Source identity and canonical URL.</li>
                <li>Capture time and source publication time when available.</li>
                <li>Evidence class: observed fact, community anecdote, inference, or hypothesis.</li>
                <li>Collection method, permission basis, reliability, and known limitations.</li>
                <li>Source-specific observation and a scheduled freshness/recheck policy.</li>
              </ul>
            </div>
            <p className="border-t border-acid-lime/20 pt-4">
              Until ingestion, provenance, and search APIs are connected, an empty state is more
              accurate than an invented market dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
