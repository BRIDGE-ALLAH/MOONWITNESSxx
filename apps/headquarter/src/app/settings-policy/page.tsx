import { Badge, Card, CardContent, CardHeader, CardTitle } from '@riotworks/ui'

const settings = [
  {
    group: 'Workspace',
    items: ['Country: (Demo)', 'Timezone: Asia/Jakarta (Demo)', 'Currencies: USD, IDR (Demo)'],
  },
  {
    group: 'Platform Eligibility',
    items: [
      'KDP: Eligibility check required',
      'Etsy: Manual workflow',
      'Shopee/TikTok Shop: Paused / policy review',
    ],
  },
  {
    group: 'Credentials Placeholders',
    items: ['No real OAuth or API keys stored in prototype', 'Connection states are labels only'],
  },
  {
    group: 'Consent & Data Controls',
    items: [
      'Consent tracking placeholder',
      'Data export/delete controls placeholder',
      'Policy review date: 2026-11-07 (Demo)',
    ],
  },
]

export default function SettingsPolicy() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">SETTINGS / POLICY CENTER</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Eligibility checks, consent, data controls, and policy review metadata.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {settings.map((s) => (
            <Card key={s.group} className="border-acid-lime/20">
              <CardHeader>
                <CardTitle className="text-lg">{s.group}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
