import { Badge, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'

const insights = [
  {
    metric: 'Discovery → Opportunity',
    value: '18% (Demo)',
    note: 'Cohort learning suggests stronger evidence improves conversion.',
  },
  {
    metric: 'Opportunity → Launch',
    value: '42% (Demo)',
    note: 'Policy hard-stops reduce wasted production.',
  },
  {
    metric: 'Product Lifetime',
    value: '7.4 mo (Demo)',
    note: 'Track by cohort, channel, and format.',
  },
  {
    metric: 'Portfolio Contribution',
    value: '+11% (Demo)',
    note: 'Demo trend only; not real revenue performance.',
  },
]

export default function Aftershock() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">AFTERSHOCK</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Discovery, conversion, product lifetime, cohort and portfolio learning.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.metric} className="border-acid-lime/20">
              <CardHeader>
                <CardTitle className="text-lg">{i.metric}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl text-acid-lime">{i.value}</p>
                <p className="mt-2 text-sm text-muted-ink">{i.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
