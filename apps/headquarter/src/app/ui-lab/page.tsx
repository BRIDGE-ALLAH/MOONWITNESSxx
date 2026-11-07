import {
  ApprovalCard,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  JobMonitor,
  RiotAtmosphere,
  RiotLiveIndicator,
  RiotSignalHeader,
  RiotSignalConstellation,
  RiotDecisionTrail,
} from '@riotworks/ui'

export default function UiLabPage() {
  return (
    <main className="min-h-screen space-y-8 p-4 sm:p-6 lg:p-8">
      <RiotAtmosphere className="p-6 sm:p-10 lg:p-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="lime">RIOTWORKS / DESIGN LAB</Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Visual system  //  Field test  07
          </span>
        </div>
        <RiotSignalHeader
          className="mt-8"
          eyebrow="Moonwitness // Signal observatory"
          index="MW—007"
          state="idle"
          statusLabel="Workbench demo"
          title="See the signal. Shape what follows."
          description="A living interface for teams that turn emerging signals into work with consequence. Cinematic at first glance. Precise under pressure."
          actions={<Button asChild variant="electric"><a href="#signal-constellation">Explore the system</a></Button>}
        />
        <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-border/60 pt-5">
          <RiotLiveIndicator state="idle" label="Illustrative state" />
          <RiotLiveIndicator state="idle" label="Standby" />
          <RiotLiveIndicator state="alert" label="Attention required" />
        </div>
      </RiotAtmosphere>

      <section className="space-y-4">
        <RiotSignalHeader
          level={2}
          eyebrow="01 // Interface language"
          index="SURFACE / TYPE / MOTION"
          title="Built to feel alive."
          description="Strong editorial hierarchy, disciplined color, and motion that signals state—not decoration."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-acid-lime/30">
            <CardHeader>
              <Badge variant="lime">NIGHT RIOT</Badge>
              <CardTitle>Signal in the dark.</CardTitle>
              <CardDescription>Graphite depth, bone typography, and a single charged accent.</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-xs text-muted-foreground"># OBSERVATION / 001</CardContent>
          </Card>
          <Card className="border-riot-orange/30">
            <CardHeader>
              <Badge variant="orange">PAPER RIOT</Badge>
              <CardTitle>Clarity in daylight.</CardTitle>
              <CardDescription>Warm paper surfaces with the same precise hierarchy.</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-xs text-muted-foreground"># OBSERVATION / 002</CardContent>
          </Card>
          <Card className="border-electric-blue/30">
            <CardHeader>
              <Badge variant="outline">MOTION</Badge>
              <CardTitle>Quiet energy.</CardTitle>
              <CardDescription>Ambient movement is slow, subtle, and removed when reduced motion is preferred.</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-xs text-muted-foreground"># OBSERVATION / 003</CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <RiotSignalHeader
          level={2}
          eyebrow="02 // Operational states"
          index="APPROVAL / JOB / STATUS"
          title="State has a language."
          description="Status is communicated through labels and structure as well as color."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ApprovalCard
            title="Campaign release approval"
            description="Approve the final asset package for scheduled release."
            requestedBy="The Forge"
            requestedAt="Today · 09:42"
            status="approved"
            metadata={<p className="text-sm text-muted-foreground">12 assets · 4 channels · Final review complete</p>}
          />
          <JobMonitor
            id="MW-JOB-2048"
            title="Signal enrichment"
            description="Collecting and normalizing source observations."
            status="running"
            progress={68}
            startedAt="09:18"
            updatedAt="09:24"
            detail="The visual is illustrative; production progress must come from the host application."
          />
        </div>
      </section>


      <section id="signal-constellation" className="space-y-4">
        <RiotSignalHeader
          level={2}
          eyebrow="03 // Signal intelligence"
          index="MILESTONE 08"
          title="See the relationships."
          description="A constellation makes connections inspectable. Every position, source, and confidence value is supplied by the host."
        />
        <RiotSignalConstellation
          nodes={[
            { id: 'signal-a', label: 'Emerging ritual', detail: 'A repeated behavior is appearing across independent communities.', x: 180, y: 300, source: 'Community observation set', observedAt: 'Demo · 09:10', confidence: 82, evidence: '3 independent observations' },
            { id: 'signal-b', label: 'Creator shift', detail: 'Creators are moving from polished output toward process-led storytelling.', x: 500, y: 150, source: 'Editorial scan', observedAt: 'Demo · 09:18', confidence: 74, evidence: '5 sampled posts' },
            { id: 'signal-c', label: 'Commerce gap', detail: 'A mismatch appears between audience intent and available product education.', x: 820, y: 310, source: 'Journey review', observedAt: 'Demo · 09:25', confidence: 68, evidence: '2 journey friction points' },
            { id: 'signal-d', label: 'New format', detail: 'A possible format opportunity connects the behavior and creator shift.', x: 490, y: 500, source: 'Analyst hypothesis', observedAt: 'Demo · 09:31', confidence: 51, evidence: 'Hypothesis; validation pending' },
          ]}
          links={[
            { from: 'signal-a', to: 'signal-b' },
            { from: 'signal-b', to: 'signal-c' },
            { from: 'signal-a', to: 'signal-d' },
            { from: 'signal-d', to: 'signal-c' },
          ]}
        />
      </section>

      <section className="space-y-4">
        <RiotSignalHeader
          level={2}
          eyebrow="04 // Decision memory"
          index="MILESTONE 09"
          title="Understand why it changed."
          description="A human-readable trace from observation to decision—with rationale and evidence attached."
        />
        <RiotDecisionTrail
          events={[
            { id: 'event-1', kind: 'observed', title: 'Behavior detected', summary: 'A repeated community ritual entered the observation set.', at: '09:10 · DEMO', actor: 'Signal Room', evidence: ['Three independent community observations'] },
            { id: 'event-2', kind: 'interpreted', title: 'Pattern connected', summary: 'The ritual was connected to a creator-format shift.', at: '09:18 · DEMO', actor: 'ARSY Deck', rationale: 'The behavior and format shift appear together, but causality is not established.', evidence: ['Five sampled creator posts', 'Cross-community recurrence'] },
            { id: 'event-3', kind: 'decided', title: 'Validation prioritized', summary: 'The team chose a small validation experiment before production.', at: '09:31 · DEMO', actor: 'The Forge', rationale: 'Confidence is promising, but evidence is not yet sufficient for a full launch.' },
          ]}
        />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>MOONWITNESS // SEE MORE. KNOW MORE.</span>
        <span>Design lab · Demo content only</span>
      </footer>
    </main>
  )
}
