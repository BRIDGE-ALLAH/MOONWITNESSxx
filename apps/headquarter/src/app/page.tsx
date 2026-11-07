import Link from 'next/link'
import { Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@riotworks/ui'

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background p-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="font-display text-6xl uppercase leading-none">
            MOONWITNESS <span className="text-riot-orange">//</span> RIOTWORKS
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Make work that outlives the feed.</p>
        </header>
        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>Creative Commerce Engine</CardTitle>
            <CardDescription>
              Headquarter is the human-facing command center. ARSY provides the backend API and orchestration runtime.
              This workspace currently displays prototype/demo content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="default"><Link href="/arsy-deck">Enter Deck</Link></Button>
            <Button asChild variant="riot"><Link href="/the-forge">Forge Work</Link></Button>
            <Button asChild variant="electric"><Link href="/signal-room">Read Signal</Link></Button>
            <Button asChild variant="outline"><Link href="/zill-watch">Inspect</Link></Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
