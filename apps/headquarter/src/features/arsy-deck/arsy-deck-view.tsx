import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'
import type { ArsyDeckSnapshot, DeckChannel } from './types'

const channelVariant: Record<DeckChannel['tone'], 'warning' | 'info' | 'outline'> = {
  warning: 'warning',
  info: 'info',
  neutral: 'outline',
}

export function ArsyDeckView({ snapshot }: { snapshot: ArsyDeckSnapshot }) {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4 border-b border-border pb-6">
          <Badge variant="warning">DEMO // NOT CONNECTED</Badge>
          <div>
            <h1 className="font-display text-4xl uppercase leading-none md:text-5xl">The work never stops</h1>
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">RIOTWORKS // ARSY DECK</p>
          </div>
          <p role="note" className="border border-warning/50 bg-warning/10 p-3 text-sm text-foreground">
            {snapshot.disclosure}
          </p>
        </header>

        <section aria-labelledby="deck-pulse-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="deck-pulse-heading" className="font-display text-xl uppercase">Workspace pulse</h2>
              <p className="text-sm text-muted-foreground">Illustrative metrics; no live workspace data is available.</p>
            </div>
            <Badge variant="outline">Source: demo fixture</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {snapshot.metrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="pb-2">
                  <CardDescription className="font-mono text-xs uppercase tracking-wide">{metric.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl">{metric.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.context}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <section aria-labelledby="deck-opportunities-heading" className="space-y-3">
            <div>
              <h2 id="deck-opportunities-heading" className="font-display text-xl uppercase">Opportunity review</h2>
              <p className="text-sm text-muted-foreground">Sample opportunities only.</p>
            </div>
            {snapshot.opportunities.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <Badge variant={item.stage === 'blocked' ? 'warning' : 'outline'}>{item.stage}</Badge>
                  </div>
                  <CardDescription>{item.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Sample confidence</span>
                    <span className="font-mono">{item.confidence}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${item.confidence}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section aria-labelledby="deck-agents-heading" className="space-y-3">
            <div>
              <h2 id="deck-agents-heading" className="font-display text-xl uppercase">Workforce preview</h2>
              <p className="text-sm text-muted-foreground">These are fixture labels, not running agents.</p>
            </div>
            {snapshot.agents.map((agent) => (
              <Card key={agent.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.responsibility}</p>
                  </div>
                  <Badge variant={agent.state === 'sample-active' ? 'info' : 'outline'}>
                    {agent.state === 'sample-active' ? 'Sample active' : 'Sample idle'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section aria-labelledby="deck-channels-heading" className="space-y-3">
            <div>
              <h2 id="deck-channels-heading" className="font-display text-xl uppercase">Channel capability preview</h2>
              <p className="text-sm text-muted-foreground">No marketplace connection or eligibility check is being performed.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.channels.map((channel) => (
                <Card key={channel.id}>
                  <CardContent className="space-y-2 p-4">
                    <p className="font-medium">{channel.name}</p>
                    <Badge variant={channelVariant[channel.tone]}>{channel.sampleState}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="deck-insights-heading" className="space-y-3">
            <div>
              <h2 id="deck-insights-heading" className="font-display text-xl uppercase">Performance examples</h2>
              <p className="text-sm text-muted-foreground">Illustrative deltas; no analytics source is connected.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {snapshot.insights.map((insight) => (
                <Card key={insight.id}>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs uppercase text-muted-foreground">{insight.label}</p>
                    <p className="font-display text-2xl">{insight.sampleDelta}</p>
                    <Badge variant="outline">Sample trend: {insight.direction}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <section aria-labelledby="deck-activity-heading" className="space-y-3">
          <div>
            <h2 id="deck-activity-heading" className="font-display text-xl uppercase">Activity examples</h2>
            <p className="text-sm text-muted-foreground">Synthetic entries to demonstrate the event layout.</p>
          </div>
          <div className="divide-y divide-border border border-border">
            {snapshot.activity.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{item.relativeTime}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
