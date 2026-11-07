import { Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@riotworks/ui'

export default function Home() {
  return (
    <main className="min-h-screen bg-obsidian text-paper-bone p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="font-display text-6xl uppercase leading-none">
            MOONWITNESS <span className="text-riot-orange">//</span> RIOTWORKS
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Make work that outlives the feed.
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>Monorepo Ready</CardTitle>
            <CardDescription>
              apps/web + packages/ui (shadcn/ui) — workspace aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="default">Enter Deck</Button>
            <Button variant="riot">Forge Work</Button>
            <Button variant="electric">Read Signal</Button>
            <Button variant="outline">Inspect</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
