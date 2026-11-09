import { Badge, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'

const assets = [
  { id: 'asset-001', name: 'Digital Art Collection #1', type: 'Image Pack', version: '1.2.0', license: 'Original / Demo license metadata', provenance: 'Source files: artwork.ai, palette.json', status: 'READY (DEMO)' },
  { id: 'asset-002', name: 'Comic Panel Series', type: 'Comic Bundle', version: '0.9.0', license: 'Review required', provenance: 'storyboard.ai, ink-sketches.ai', status: 'NEEDS REVIEW (DEMO)' },
  { id: 'asset-003', name: 'Music Beat License', type: 'Audio', version: '1.0.1', license: 'Original / Demo license metadata', provenance: 'stems.wav, project.ableton', status: 'ARCHIVED (DEMO)' },
]

export default function SidraArchive() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">SIDRA ARCHIVE</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">Asset catalog, versions, licenses, and provenance.</p>
        </header>
        <div className="grid gap-4">
          {assets.map((a) => (
            <Card key={a.id} className="border-acid-lime/20">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xl">{a.name}</CardTitle>
                <Badge variant="outline">{a.status}</Badge>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm md:grid-cols-2">
                <p><span className="font-mono text-muted-ink">ID:</span> {a.id}</p>
                <p><span className="font-mono text-muted-ink">Type:</span> {a.type}</p>
                <p><span className="font-mono text-muted-ink">Version:</span> {a.version}</p>
                <p><span className="font-mono text-muted-ink">License:</span> {a.license}</p>
                <p className="md:col-span-2"><span className="font-mono text-muted-ink">Provenance:</span> {a.provenance}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
