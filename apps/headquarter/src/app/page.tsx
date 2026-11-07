import Link from 'next/link'
import { AssetImage } from '@riotworks/assets'
import { Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@riotworks/ui'

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
          <div className="space-y-5">
            <Badge variant="outline">OBSERVE · RECORD · VERIFY · CONNECT · SHARE</Badge>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              SEE MORE.<br /><span className="text-signal-gold">KNOW MORE.</span>
            </h1>
            <p className="max-w-2xl font-mono text-sm uppercase leading-relaxed tracking-wide text-muted-foreground">
              An observatory for evidence, knowledge, and human understanding.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <AssetImage name="illustration.observation-desk" alt="A telescope and field notebook beneath a lunar disc." className="h-auto w-full text-signal-gold" />
          </div>
        </header>

        <section aria-labelledby="manifesto-title" className="border-y border-signal-gold/30 py-8 md:py-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-signal-gold">THE MOONWITNESS MANIFESTO</p>
          <h2 id="manifesto-title" className="max-w-4xl font-display text-3xl font-semibold leading-tight md:text-5xl">
            WHEN THE MOON RISES,<br />WE SHARE <span className="text-signal-gold">MESSAGES.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every observation can become understanding. Every verified discovery deserves its context. We bring evidence and human curiosity together, then share what we learn.
          </p>
        </section>

        <Card className="border-signal-gold/25">
          <CardHeader>
            <CardTitle>MOONWITNESS Observatory</CardTitle>
            <CardDescription>
              A human-facing command center for observing, recording, verifying, and connecting evidence.
              ARSY provides the backend API and orchestration runtime. This workspace currently displays prototype/demo content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="default"><Link href="/arsy-deck">Enter Observatory</Link></Button>
            <Button asChild variant="secondary"><Link href="/sidra-archive">Explore Archive</Link></Button>
            <Button asChild variant="outline"><Link href="/signal-room">Read Signals</Link></Button>
            <Button asChild variant="outline"><Link href="/zill-watch">Inspect Evidence</Link></Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
