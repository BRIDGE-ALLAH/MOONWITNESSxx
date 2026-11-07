import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  RiotAtmosphere,
  RiotLiveIndicator,
  RiotSignalHeader,
} from '@riotworks/ui'

const signals = [
  { index: '01', title: 'Observe', description: 'Find the signal before it becomes obvious.', route: '/signal-room', label: 'Signal Room' },
  { index: '02', title: 'Interpret', description: 'Turn scattered evidence into clear direction.', route: '/arsy-deck', label: 'ARSY Deck' },
  { index: '03', title: 'Make', description: 'Move insight into work that has consequence.', route: '/the-forge', label: 'The Forge' },
]

export default function Home() {
  return (
    <main className="min-h-screen space-y-10 p-4 sm:p-6 lg:p-8">
      <RiotAtmosphere className="p-6 sm:p-10 lg:p-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge variant="lime">MOONWITNESS // RIOTWORKS</Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Independent signal intelligence · 00—∞
          </span>
        </div>

        <RiotSignalHeader
          className="mt-12"
          eyebrow="A living creative commerce engine"
          index="MW / 001"
          state="idle"
          statusLabel="Prototype / demo environment"
          title={<>SEE MORE.<span className="text-riot-orange"> KNOW MORE.</span></>}
          description="When the moon rises, we share messages. Discover what is emerging, understand what it means, and make work that outlives the feed."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="riot"><Link href="/signal-room">Enter the signal room</Link></Button>
              <Button asChild variant="outline"><Link href="/arsy-deck">Explore ARSY</Link></Button>
            </div>
          }
        />

        <div className="mt-12 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Observe</p>
            <p className="mt-1 font-display text-2xl uppercase">Signals</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Understand</p>
            <p className="mt-1 font-display text-2xl uppercase">Meaning</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Create</p>
            <p className="mt-1 font-display text-2xl uppercase">Impact</p>
          </div>
        </div>
      </RiotAtmosphere>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <RiotSignalHeader
            level={2}
            eyebrow="The operating rhythm"
            index="01 / 03"
            title="From signal to impact."
            description="A connected journey from seeing what others miss to creating work that lasts."
          />
          <RiotLiveIndicator state="idle" label="Demo environment" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {signals.map((signal) => (
            <Card key={signal.index} className="group border-border/70 transition-colors duration-standard hover:border-acid-lime/60">
              <CardHeader>
                <span className="font-mono text-xs tracking-widest text-acid-lime">/{signal.index}</span>
                <CardTitle className="mt-4 text-3xl">{signal.title}</CardTitle>
                <CardDescription>{signal.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" size="sm" className="px-0 group-hover:text-acid-lime">
                  <Link href={signal.route}>{signal.label} <span aria-hidden="true">↗</span></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>MOONWITNESS // SEE MORE. KNOW MORE.</span>
        <span>Prototype // Demo data only</span>
      </footer>
    </main>
  )
}
