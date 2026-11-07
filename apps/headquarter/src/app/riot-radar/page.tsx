import { Badge, Card, CardHeader, CardTitle, CardContent } from '@riotworks/ui'

const opportunities = [
  {
    id: 1,
    buyerProblem: 'Artists struggle to monetize digital work due to high platform fees and lack of direct fan connection.',
    sourceEvidence: 'Twitter thread analysis showing 10,000+ artists complaining about platform fees; forum discussions about direct fan payment solutions.',
    demandSignals: 'High engagement with artist content; growing creator economy; creator-funding platforms growing 40% YoY.',
    competitionGap: 'Most existing platforms take 15-30% fees; few focus on direct fan-artist relationship; few integrate royalty royalties automatically.',
    productDifferentiation: 'RIOTWORKS platform takes 5% fees; built-in fan club functionality; automatic royalty distribution via smart contracts; artist-owned portfolio management.',
    channelSuitability: 'Twitter community; Discord artist communities; NFT marketplace integrations; creator platform integrations.',
    unitEconomicsAssumptions: 'Average artist lifetime value: $2,400; platform fee: 5% of sales; customer acquisition cost: $48; payback period: 6 months.',
    productionComplexity: 'Low - platform is digital-only; no physical inventory; smart contract deployment required; artist onboarding flow needed.',
    policyGate: 'PENDING - Must pass similarity check and provenance verification before launch.',
    confidence: 82,
    recommendation: 'RESEARCH MORE - Platform concept validated but need artist interviews and pilot program.',
    actions: [
      { label: 'Go', color: 'default', action: 'proceed to pilot' },
      { label: 'Research More', color: 'info', action: 'conduct artist interviews' },
      { label: 'Reject', color: 'error', action: 'decline opportunity' },
    ],
  },
  {
    id: 2,
    buyerProblem: 'Content creators cannot easily tokenize their work and sell directly to fans.',
    sourceEvidence: 'Forum discussions; creator surveys; analysis of existing platform limitations.',
    demandSignals: 'Growing creator economy; 50M+ creators seeking monetization; high engagement with token-gated content.',
    competitionGap: 'Most platforms take 20-30% fees; few integrate royalty royalties; few have artist-owned portfolio management.',
    productDifferentiation: 'RIOTWORKS platform takes 5% fees; built-in fan club functionality; automatic royalty distribution via smart contracts; artist-owned portfolio management.',
    channelSuitability: 'Twitter community; Discord creator communities; NFT marketplace integrations; creator platform integrations.',
    unitEconomicsAssumptions: 'Average creator lifetime value: $1,800; platform fee: 5% of sales; customer acquisition cost: $42; payback period: 5 months.',
    productionComplexity: 'Low - platform is digital-only; no physical inventory; smart contract deployment required; creator onboarding flow needed.',
    policyGate: 'PENDING - Must pass similarity check and provenance verification before launch.',
    confidence: 78,
    recommendation: 'RESEARCH MORE - Concept validated but need creator interviews and pilot program.',
    actions: [
      { label: 'Go', color: 'default', action: 'proceed to pilot' },
      { label: 'Research More', color: 'info', action: 'conduct creator interviews' },
      { label: 'Reject', color: 'error', action: 'decline opportunity' },
    ],
  },
  {
    id: 3,
    buyerProblem: 'Content creators cannot easily tokenize their work and sell directly to fans.',
    sourceEvidence: 'Forum discussions; creator surveys; analysis of existing platform limitations.',
    demandSignals: 'Growing creator economy; 50M+ creators seeking monetization; high engagement with token-gated content.',
    competitionGap: 'Most platforms take 20-30% fees; few integrate royalty royalties; few have artist-owned portfolio management.',
    productDifferentiation: 'RIOTWORKS platform takes 5% fees; built-in fan club functionality; automatic royalty distribution via smart contracts; artist-owned portfolio management.',
    channelSuitability: 'Twitter community; Discord creator communities; NFT marketplace integrations; creator platform integrations.',
    unitEconomicsAssumptions: 'Average creator lifetime value: $1,800; platform fee: 5% of sales; customer acquisition cost: $42; payback period: 5 months.',
    productionComplexity: 'Low - platform is digital-only; no physical inventory; smart contract deployment required; creator onboarding flow needed.',
    policyGate: 'HARD STOP - Similarity check failed; cannot override with high score.',
    confidence: 91,
    recommendation: 'REJECT - Similarity to existing content too high; risk of IP dispute.',
    actions: [
      { label: 'Go', color: 'default', action: 'proceed to pilot' },
      { label: 'Research More', color: 'info', action: 'conduct creator interviews' },
      { label: 'Reject', color: 'error', action: 'decline opportunity' },
    ],
  },
]

export default function RIOTRadar() {
  return (
    <main className="min-h-screen bg-obsidian text-paper-bone p-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-acid-lime/30 pb-8 mb-8">
          <h1 className="text-5xl font-display uppercase leading-none mb-4">
            RIOT RADAR
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Opportunity Lab
          </p>
        </header>

        <section className="space-y-6">
          {opportunities.map((opp) => (
            <Card key={opp.id} className="border-2 border-opacity-50 hover:border-acid-lime/50">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider">{opp.id}. Buyer Problem Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Buyer Problem
                  </summary>
                  <p>{opp.buyerProblem}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Source Evidence
                  </summary>
                  <p>{opp.sourceEvidence}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Demand Signals
                  </summary>
                  <p>{opp.demandSignals}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Competition Gap
                  </summary>
                  <p>{opp.competitionGap}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Product Differentiation
                  </summary>
                  <p>{opp.productDifferentiation}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Channel Suitability
                  </summary>
                  <p>{opp.channelSuitability}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Unit Economics
                  </summary>
                  <p>{opp.unitEconomicsAssumptions}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Production Complexity
                  </summary>
                  <p>{opp.productionComplexity}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Policy Gate
                  </summary>
                  <p>
                    <strong>{opp.policyGate}</strong>{' '}
                    <Badge variant={opp.policyGate.includes('HARD STOP') ? 'destructive' : 'outline'}>
                      {opp.policyGate.includes('HARD STOP') ? 'HARD STOP' : 'REVIEW'}
                    </Badge>
                  </p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Confidence
                  </summary>
                  <p>
                    <strong>{opp.confidence}%</strong>
                    <Badge variant="electric" className="text-xs ml-2">
                      {opp.confidence}
                    </Badge>
                  </p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Recommendation
                  </summary>
                  <p><strong>{opp.recommendation}</strong></p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Actions
                  </summary>
                  <div className="flex gap-2">
                    {opp.actions.map((action) => (
                      <Badge
                        key={action.label}
                        variant={action.color === 'error' ? 'destructive' : action.color === 'info' ? 'electric' : 'lime'}
                        className="px-3 py-1 text-xs"
                      >
                        {action.label}
                      </Badge>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}