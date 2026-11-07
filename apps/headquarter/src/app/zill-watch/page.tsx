import { Badge, Card, CardContent, CardHeader } from '@riotworks/ui'

const policyChecks = [
  { id: 1, category: 'IP & Licensing', status: 'PASS', details: 'Source provenance verified; licensing disclosures present.' },
  { id: 2, category: 'Similarity', status: 'WARNING', details: 'Similar content detected below threshold (85%).' },
  { id: 3, category: 'Technical Specification', status: 'PASS', details: 'All required metadata present.' },
  { id: 4, category: 'Licensing', status: 'BLOCKED', details: 'Missing platform disclosures; policy violation.' },
] as const

const statusVariant = (s: string): 'lime' | 'orange' | 'destructive' =>
  s === 'PASS' ? 'lime' : s === 'WARNING' ? 'orange' : 'destructive'

const metadata = {
  id: 'prod-001',
  title: 'Digital Art Collection #1',
  creator: 'Artist Alpha',
  created: '2024-01-15',
  license: 'CC0 (public domain)',
  platformDisclosures: 'Not connected to any marketplace',
  similarityScore: 85,
}

export default function ZILLWatch() {
  return (
    <main className="min-h-screen bg-obsidian text-paper-bone p-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-acid-lime/30 pb-8 mb-8">
          <h1 className="text-5xl font-display uppercase leading-none mb-4">
            ZILL WATCH
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Quality & Integrity
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Policy Checks</h2>
          <div className="grid grid-cols-2 gap-4">
            {policyChecks.map((check) => (
              <Card key={check.id} className="border-2 border-0 border-y-2">
                <CardHeader>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-mono uppercase tracking-widest">{check.category}</span>
                    <Badge variant={statusVariant(check.status)} className="ml-2 text-xs">{check.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{check.details}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-display uppercase tracking-wider mb-4">Metadata</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium">ID</p>
              <p>{metadata.id}</p>
            </div>
            <div>
              <p className="font-medium">Title</p>
              <p>{metadata.title}</p>
            </div>
            <div>
              <p className="font-medium">Creator</p>
              <p>{metadata.creator}</p>
            </div>
            <div>
              <p className="font-medium">Created</p>
              <p>{metadata.created}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium">License</p>
              <p>{metadata.license}</p>
            </div>
            <div>
              <p className="font-medium">Platform Disclosures</p>
              <p>{metadata.platformDisclosures}</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-display text-xl uppercase tracking-wider">Similarity Score</h2>
          <Badge variant="orange" className="font-display text-3xl font-bold">{metadata.similarityScore}%</Badge>
          <p className="text-sm text-muted-foreground">Below threshold (85%); requires review before publication.</p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-display text-xl uppercase tracking-wider">Policy State Summary</h2>
          <div className="flex gap-2">
            {(['PASS', 'WARNING', 'BLOCKED', 'NEEDS REVIEW'] as const).map((s) => (
              <Badge key={s} variant={s === 'PASS' ? 'lime' : s === 'BLOCKED' ? 'destructive' : 'orange'}>{s}</Badge>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Policy violations are hard blocks, not just score deductions.</p>
        </section>
      </div>
    </main>
  )
}