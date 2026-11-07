import { Badge, Card, CardHeader, CardTitle, CardContent } from '@riotworks/ui'

const metrics = [
  { label: 'Active Products', value: 12, subtitle: 'Live now', icon: '📦' },
  { label: 'Pipeline', value: 24, subtitle: 'In progress', icon: '🔄' },
  { label: 'Marketplace Readiness', value: 85, subtitle: '%', icon: '🏪' },
  { label: 'Gross Receipts', value: 125000, subtitle: '$', icon: '💰' },
  { label: 'Net Contribution', value: 89000, subtitle: '$', icon: '💵' },
  { label: 'Active Agents', value: 5, subtitle: 'Running', icon: '👥' },
  { label: 'Experiments', value: 15, subtitle: 'Running', icon: '🧪' },
  { label: 'Business Pulse', value: 92, subtitle: '%', icon: '📊' },
]

const opportunities = [
  { id: 1, title: 'New Market Entry', description: 'Expanding to Southeast Asia', confidence: 85, status: 'opportunity' },
  { id: 2, title: 'New Product Line', description: 'AI-powered digital art', confidence: 72, status: 'opportunity' },
  { id: 3, title: 'Channel Expansion', description: 'New platform integration', confidence: 68, status: 'opportunity' },
]

const aiWorkforce = [
  { name: 'Scout', role: 'Market Discovery', status: 'active' },
  { name: 'Maker', role: 'Creative Production', status: 'active' },
  { name: 'Keeper', role: 'Asset Management', status: 'active' },
  { name: 'Analyzer', role: 'Market Analysis', status: 'pending' },
]

const channelHealth = [
  { platform: 'KDP', status: 'not connected', color: 'error' },
  { platform: 'Etsy', status: 'eligibility check required', color: 'warning' },
  { platform: 'Gumroad', status: 'manual workflow', color: 'info' },
  { platform: 'Adobe Stock', status: 'limited integration', color: 'info' },
]

const activityFeed = [
  { id: 1, title: 'New product uploaded', description: 'Product #123 added to marketplace', time: '2 hours ago', avatar: '📦' },
  { id: 2, title: 'Experiment launched', description: 'New A/B test started', time: 'yesterday', avatar: '🧪' },
  { id: 3, title: 'Agent task completed', description: 'AI workforce task finished', time: '2 days ago', avatar: '👥' },
]

const aftershockInsights = [
  { id: 1, metric: 'Conversion', change: '+12%', trend: 'up' },
  { id: 2, metric: 'Product Lifetime', change: '+8%', trend: 'up' },
  { id: 3, metric: 'Cohort Retention', change: '+5%', trend: 'up' },
]

export default function ARSYDeck() {
  return (
    <main className="theme-observatory min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-signal-gold/30 pb-8">
          <Badge variant="outline">MOONWITNESS OBSERVATORY · DEMO DATA</Badge>
          <h1 className="mb-4 mt-4 text-5xl font-display uppercase leading-none">
            OBSERVE THE WORK.<br />UNDERSTAND THE SIGNAL.
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            SEE MORE. KNOW MORE.
          </p>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="border-signal-gold/30">
              <CardHeader>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-sm uppercase tracking-widest text-muted-ink">{metric.label}</span>
                  <Badge variant={metric.value > 90 ? 'lime' : 'default'}>{metric.value}%</Badge>
                </div>
                <CardTitle className="hidden">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-display font-bold ${metric.value > 90 ? 'text-signal-gold' : 'text-paper-bone'}`}>
                  {metric.value}
                </div>
                <p className="text-sm text-muted-foreground">{metric.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-6">
          <h2 className="mb-4 text-xl font-display uppercase tracking-wider">Opportunity Radar</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {opportunities.map((opp) => (
              <Card key={opp.id} className="border-2 border-opacity-50 hover:border-signal-gold/50">
                <CardHeader><CardTitle className="text-sm uppercase tracking-wider">{opp.title}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{opp.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-xs">{opp.confidence}%</span>
                    <Badge variant="outline">{opp.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-6">
          <h2 className="mb-4 text-xl font-display uppercase tracking-wider">Production Pipeline</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {aiWorkforce.map((agent) => (
              <Card key={agent.name} className="border-2 border-opacity-50 hover:border-signal-gold/50">
                <CardHeader><CardTitle className="text-sm uppercase tracking-wider">{agent.name}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{agent.role}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span>{agent.status}</span>
                    <Badge variant="secondary">{agent.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-6">
          <h2 className="mb-4 text-xl font-display uppercase tracking-wider">Channel Health</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {channelHealth.map((channel) => (
              <Card key={channel.platform} className="border-2 border-opacity-50 hover:border-signal-gold/50">
                <CardHeader><CardTitle className="text-sm uppercase tracking-wider">{channel.platform}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{channel.status}</p>
                  <Badge variant={channel.status === 'not connected' ? 'destructive' : 'outline'}>{channel.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-6">
          <h2 className="mb-4 text-xl font-display uppercase tracking-wider">Activity Feed</h2>
          <div className="space-y-3">
            {activityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-signal-gold/20 p-3 last:border-0">
                <span className="text-xl">{item.avatar}</span>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-6">
          <h2 className="mb-4 text-xl font-display uppercase tracking-wider">AFTERSHOCK Insights</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {aftershockInsights.map((insight) => (
              <Card key={insight.id} className="border-2 border-opacity-50 hover:border-signal-gold/50">
                <CardHeader><CardTitle className="text-sm uppercase tracking-wider">{insight.metric}</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-3xl font-display font-bold ${insight.change.includes('-') ? 'text-signal-red' : 'text-signal-gold'}`}>
                    {insight.change}
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.trend} trend</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
