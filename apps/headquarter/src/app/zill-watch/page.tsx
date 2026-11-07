import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function ZILLWatch() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">ZILL Watch</h1>
            <Badge variant="outline">Inspection service not connected</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Rights, quality, and product integrity
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No verified inspections yet</CardTitle>
            <CardDescription>
              No real asset, provenance, licensing, policy, or similarity-inspection service is
              connected. This page cannot currently issue a pass, warning, or block for a product.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              The previous screen contained a fictional product, creator, license, inspection
              outcomes, and a fixed similarity percentage. Those values were not produced by an
              inspection and have been removed.
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">
                Evidence required for an inspection
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Actual product/version and asset identifiers.</li>
                <li>Source assets, ownership or license evidence, and derivative relationships.</li>
                <li>Tool/model provenance and required platform disclosures.</li>
                <li>Inspection method, version, timestamp, actor, findings, and evidence references.</li>
                <li>A documented similarity method and review threshold before any score is shown.</li>
              </ul>
            </div>
            <p className="border-t border-acid-lime/20 pt-4">
              Rights and policy failures must remain hard blocks. No asset will be marked compliant
              or safe until a real, evidence-backed inspection has been recorded.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
