import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@riotworks/ui'

const trendData = [
  { id: 1, title: 'Digital Art Collectibles', category: 'digital-art', trend: 'up', confidence: 85, source: 'Twitter', sourceLink: 'https://twitter.com' },
  { id: 2, title: 'NFT Gaming', category: 'gaming', trend: 'up', confidence: 72, source: 'Twitter', sourceLink: 'https://twitter.com' },
  { id: 3, title: 'Music NFTs', category: 'music', trend: 'down', confidence: 68, source: 'Twitter', sourceLink: 'https://twitter.com' },
  { id: 4, title: 'Metaverse Land', category: 'virtual', trend: 'sideways', confidence: 55, source: 'Twitter', sourceLink: 'https://twitter.com' },
]

const categoryData = [
  { id: 1, name: 'digital-art', label: 'Digital Art', count: 45, trend: 'up' },
  { id: 2, name: 'comic', label: 'Comic', count: 32, trend: 'up' },
  { id: 3, name: 'music', label: 'Music', count: 28, trend: 'down' },
  { id: 4, name: 'virtual', label: 'Virtual', count: 15, trend: 'sideways' },
]

const sourceStreams = [
  { id: 1, name: 'Twitter', type: 'social', confidence: 80, verified: true },
  { id: 2, name: 'Discord', type: 'social', confidence: 70, verified: true },
  { id: 3, name: 'Reddit', type: 'community', confidence: 60, verified: false },
  { id: 4, name: 'Medium', type: 'blog', confidence: 55, verified: true },
]

const buyerProblems = [
  { id: 1, problem: 'High gas fees', severity: 'high', affected: '89%' },
  { id: 2, problem: 'Complex UX', severity: 'medium', affected: '67%' },
  { id: 3, problem: 'Copyright concerns', severity: 'high', affected: '92%' },
  { id: 3, problem: 'Low discoverability', severity: 'medium', affected: '55%' },
]

const marketplaceObservations = [
  { id: 1, platform: 'OpenSea', observation: 'Floor prices stabilizing', trend: 'up' },
  { id: 2, platform: 'Magic Eden', observation: 'New collection drops increasing', trend: 'up' },
  { id: 2, platform: 'Rarible', observation: 'Volume decreasing', trend: 'down' },
]

const evidenceData = [
  { id: 1, title: 'Twitter Thread Analysis', date: '2024-01-15', type: 'sourced', confidence: 85 },
  { id: 2, title: 'Community Sentiment Survey', date: '2024-01-10', type: 'sourced', confidence: 72 },
  { id: 2, title: 'AI-Generated Market Forecast', date: '2024-01-08', type: 'model-generated', confidence: 60 },
]

const researchStatus = [
  { id: 1, status: 'sourced', label: 'Sourced Evidence', count: 24, badgeColor: 'info' },
  { id: 2, status: 'hypothesis', label: 'Model Hypothesis', count: 15, badgeColor: 'warning' },
  { id: 3, status: 'model-generated', label: 'Model-Generated', count: 8, badgeColor: 'default' },
]

export default function SignalRoom() {
  return (
    <main className="min-h-screen bg-obsidian text-paper-bone p-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-acid-lime/30 pb-8 mb-8">
          <h1 className="text-5xl font-display uppercase leading-none mb-4">
            READ THE SIGNAL
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            RIOTWORKS Market Intelligence
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {trendData.map((trend) => (
            <Card key={trend.id} className="border-acid-lime/30">
              <CardHeader>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-mono uppercase tracking-widest text-muted-icon">{trend.title}</span>
                  <Badge status={trend.trend === 'up' ? 'lime' : trend.trend === 'down' ? 'error' : 'default'}>{trend.confidence}%</Badge>
                </div>
                <CardTitle className="hidden">{trend.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold {trend.trend === 'up' ? 'text-acid-lime' : trend.trend === 'down' ? 'text-error' : 'text-paper-bone'}">
                  {trend.trend === 'up' ? '▲' : trend.trend === 'down' ? '▼' : '—'}
                </div>
                <p className="text-sm text-muted-foreground">{trend.category}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Category Discovery</h2>
          <div className="grid grid-cols-2 gap-2">
            {categoryData.map((cat) => (
              <Badge key={cat.id} status={cat.trend === 'up' ? 'default' : cat.trend === 'down' ? 'error' : 'default'} className="text-xs font-mono uppercase tracking-wider">
                {cat.label} <span className="text-xs">{cat.count}</span>
              </Badge>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Source Streams</h2>
          <div className="grid grid-cols-2 gap-2">
            {sourceStreams.map((stream) => (
              <Badge key={stream.id} status={stream.verified ? 'default' : 'error'} className="text-xs font-mono uppercase tracking-wider">
                {stream.name} <span className="text-xs">({stream.confidence}%)</span>
              </Badge>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Buyer Problems</h2>
          <div className="grid grid-cols-2 gap-4">
            {buyerProblems.map((problem) => (
              <Card key={problem.id} className="border-2 border-opacity-50 hover:border-acid-lime/50">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider">{problem.problem}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{`Affected: ${problem.affected}%`}</p>
                  <Badge status={problem.severity === 'high' ? 'error' : 'warning'} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Marketplace Observations</h2>
          <div className="grid grid-cols-2 gap-4">
            {marketplaceObservations.map((obs) => (
              <Card key={obs.id} className="border-2 border-opacity-50 hover:border-acid-lime/50">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider">{obs.platform}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{obs.observation}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span>{obs.trend === 'up' ? '▲' : '▼'}</span>
                    <Badge status={obs.trend === 'up' ? 'default' : 'error'} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Research Status</h2>
          <div className="grid grid-cols-3 gap-2">
            {researchStatus.map((status) => (
              <Badge key={status.id} status={status.badgeColor} className="text-xs font-mono uppercase tracking-wider">
                {status.label} <span className="text-xs">{status.count}</span>
              </Badge>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}