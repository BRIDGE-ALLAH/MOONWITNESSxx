import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function MizanLedger() {
  return (
    <main className="min-h-screen bg-obsidian p-8 text-paper-bone">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">Mizan Ledger</h1>
            <Badge variant="outline">Financial data not connected</Badge>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Receipts, fees, refunds, costs, reserves, reconciliation, and payouts
          </p>
        </header>

        <Card className="border-acid-lime/30">
          <CardHeader>
            <CardTitle>No verified financial events yet</CardTitle>
            <CardDescription>
              This workspace is not connected to a financial-event or payout source. No actual
              receipts, fees, refunds, balances, tax reserves, or payouts are available to display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-ink">
            <p>
              The previous rows were static examples with invented products, amounts, costs, and
              payout states. They have been removed and must not be treated as transactions or
              financial history.
            </p>
            <div className="space-y-2">
              <h2 className="font-display text-base uppercase text-paper-bone">
                Requirements for a real ledger entry
              </h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Persisted event identity, owner, actor, and idempotency key.</li>
                <li>Exact amount in integer minor units with an ISO currency code.</li>
                <li>Event type, occurred/recorded timestamps, and source evidence.</li>
                <li>Separate reconciliation state for pending, verified, disputed, and reversed events.</li>
                <li>Fees, refunds, chargebacks, costs, FX, reserves, and payouts kept distinct.</li>
              </ul>
            </div>
            <p className="border-t border-acid-lime/20 pt-4">
              Balances and net contribution will be calculated from persisted source events. This
              page intentionally shows no totals until those records and reconciliation rules exist.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
