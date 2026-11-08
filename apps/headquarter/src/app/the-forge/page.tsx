import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function TheForge() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">The Forge</h1>
            <Badge variant="outline">Product records not connected</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Product workshop, versions, assets, and quality review
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No persisted products yet</CardTitle>
            <CardDescription>
              The product workshop is not connected to a persisted product and asset lifecycle.
              There are no approved product briefs, versions, source files, or inspection records
              available to display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              The previous cards described fictional products, filenames, tool provenance,
              production states, and distribution packages. Placeholder image URLs were not product
              assets. Those examples have been removed rather than presented as real work.
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">
                Requirements for a real product record
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>An approved opportunity and versioned product brief.</li>
                <li>Persisted product/version identity and acceptance criteria.</li>
                <li>Actual stored assets with checksums and source relationships.</li>
                <li>Creator, license, tool/model, edit history, and derivative provenance.</li>
                <li>Recorded rights, policy, technical, and creative inspections.</li>
              </ul>
            </div>
            <p className="border-t border-acid-lime/20 pt-4">
              Product creation and promotion will be enabled only when the underlying records,
              storage, provenance, and authorization contracts are available.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
