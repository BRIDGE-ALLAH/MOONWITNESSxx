import { Badge, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'

const channels = [
  { platform: 'KDP', capability: 'Book listing package', state: 'ELIGIBILITY CHECK REQUIRED', integration: 'MANUAL WORKFLOW', notes: 'Demo only. No account connection or publication.' },
  { platform: 'Adobe Stock', capability: 'Asset metadata/spec export', state: 'LIMITED OFFICIAL INTEGRATION', integration: 'MANUAL PACKAGE', notes: 'Verify exact action before any API claim.' },
  { platform: 'Etsy', capability: 'Listing prep bundle', state: 'NOT CONNECTED', integration: 'MANUAL WORKFLOW', notes: 'No fake publish or authorization.' },
  { platform: 'Gumroad', capability: 'Product package export', state: 'ELIGIBILITY CHECK REQUIRED', integration: 'MANUAL WORKFLOW', notes: 'Prototype action only.' },
  { platform: 'Shopee / TikTok Shop', capability: 'Commerce listing prep', state: 'PAUSED / POLICY REVIEW', integration: 'MANUAL WORKFLOW', notes: 'Region/policy eligibility required.' },
]

const publicationHistory = [
  { id: 'pub-001', product: 'Digital Art Collection #1', channel: 'Gumroad', status: 'PREPARED (DEMO)', date: '2026-11-01' },
  { id: 'pub-002', product: 'Comic Panel Series', channel: 'Etsy', status: 'BLOCKED BY POLICY (DEMO)', date: '2026-11-02' },
]

export default function LaunchBay() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">LAUNCH BAY</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Channel capability, listing prep, and publication history — no real marketplace connections.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {channels.map((c) => (
            <Card key={c.platform} className="border-acid-lime/20">
              <CardHeader>
                <CardTitle className="text-xl">{c.platform}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-mono text-muted-ink">Capability:</span> {c.capability}</p>
                <p><span className="font-mono text-muted-ink">State:</span> <Badge variant="outline">{c.state}</Badge></p>
                <p><span className="font-mono text-muted-ink">Integration:</span> {c.integration}</p>
                <p className="text-muted-ink">{c.notes}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl uppercase">Publication History (Demo)</h2>
          <div className="overflow-x-auto rounded-sm border border-acid-lime/20">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-charcoal font-mono uppercase text-muted-ink">
                <tr><th className="p-3">ID</th><th className="p-3">Product</th><th className="p-3">Channel</th><th className="p-3">Status</th><th className="p-3">Date</th></tr>
              </thead>
              <tbody>
                {publicationHistory.map((r) => (
                  <tr key={r.id} className="border-t border-acid-lime/10">
                    <td className="p-3 font-mono">{r.id}</td><td className="p-3">{r.product}</td><td className="p-3">{r.channel}</td><td className="p-3">{r.status}</td><td className="p-3 font-mono">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
