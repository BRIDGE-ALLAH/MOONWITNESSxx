import { Badge, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'

const agents = [
  { name: 'THE SCOUT', status: 'RUNNING (DEMO)', task: 'Market signal scan', budget: '$12 cap', approval: 'Auto for research' },
  { name: 'THE MAKER', status: 'IDLE (DEMO)', task: 'Awaiting brief', budget: '$30 cap', approval: 'Human review before publish package' },
  { name: 'ZILL', status: 'RUNNING (DEMO)', task: 'Policy & integrity checks', budget: 'N/A', approval: 'Hard-stop authority' },
  { name: 'THE KEEPER', status: 'SCHEDULED (DEMO)', task: 'Asset/version audit', budget: '$5 cap', approval: 'Auto for metadata' },
]

export default function RiotEngine() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">RIOT ENGINE</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">Specialist agents, runs, schedules, budgets, queue, approvals, logs.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.name} className="border-acid-lime/20">
              <CardHeader><CardTitle>{a.name}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="font-mono text-muted-ink">Status:</span> <Badge variant="outline">{a.status}</Badge></p>
                <p><span className="font-mono text-muted-ink">Task:</span> {a.task}</p>
                <p><span className="font-mono text-muted-ink">Budget:</span> {a.budget}</p>
                <p><span className="font-mono text-muted-ink">Approval:</span> {a.approval}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
