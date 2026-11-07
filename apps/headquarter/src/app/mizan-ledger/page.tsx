import { Badge } from '@riotworks/ui'

const rows = [
  {
    product: 'Digital Art Collection #1',
    gross: 1200,
    fees: 180,
    refunds: 40,
    variable: 60,
    taxReserve: 184,
    net: 736,
    payout: 'Pending (Demo)',
  },
  {
    product: 'Comic Panel Series',
    gross: 860,
    fees: 129,
    refunds: 0,
    variable: 95,
    taxReserve: 127,
    net: 509,
    payout: 'Scheduled (Demo)',
  },
  {
    product: 'Music Beat License',
    gross: 540,
    fees: 81,
    refunds: 20,
    variable: 30,
    taxReserve: 82,
    net: 327,
    payout: 'Pending (Demo)',
  },
]

export default function MizanLedger() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-acid-lime/30 pb-6">
          <Badge variant="lime">Prototype // Demo Data Only — Not Real Financials</Badge>
          <h1 className="mt-3 font-display text-5xl uppercase">MIZAN LEDGER</h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Gross, fees, refunds, variable cost, tax reserve, net contribution, payout.
          </p>
        </header>
        <div className="overflow-x-auto rounded-sm border border-acid-lime/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-charcoal font-mono uppercase text-muted-ink">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Gross</th>
                <th className="p-3">Fees</th>
                <th className="p-3">Refunds</th>
                <th className="p-3">Variable Cost</th>
                <th className="p-3">Tax Reserve</th>
                <th className="p-3">Net</th>
                <th className="p-3">Payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product} className="border-t border-acid-lime/10">
                  <td className="p-3">{r.product}</td>
                  <td className="p-3 font-mono">${r.gross}</td>
                  <td className="p-3 font-mono">${r.fees}</td>
                  <td className="p-3 font-mono">${r.refunds}</td>
                  <td className="p-3 font-mono">${r.variable}</td>
                  <td className="p-3 font-mono">${r.taxReserve}</td>
                  <td className="p-3 font-mono text-acid-lime">${r.net}</td>
                  <td className="p-3">{r.payout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
