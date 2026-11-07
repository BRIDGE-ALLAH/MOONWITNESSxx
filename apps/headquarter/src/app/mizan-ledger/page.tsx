import { cookies } from 'next/headers'
import { FinancialLedger } from '../../features/money-maker/financial-ledger'
import { OperatorLoginForm } from '../../features/money-maker/operator-login-form'
import {
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  verifyOperatorSession,
} from '../../lib/operator-session'

export const dynamic = 'force-dynamic'

export default async function MizanLedgerPage() {
  const config = getOperatorSessionConfig()
  if (!config) {
    return (
      <main className="min-h-[70vh] bg-obsidian p-8 text-paper-bone">
        <div role="alert" className="mx-auto max-w-2xl border border-red-500/50 p-6">
          <h1 className="font-display text-2xl uppercase">Operator access unavailable</h1>
          <p className="mt-3 text-sm text-muted-ink">
            Headquarter operator authentication is not configured. Set the operator password,
            session secret, operator ID, and public HTTPS origin before accessing financial records.
          </p>
        </div>
      </main>
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(OPERATOR_SESSION_COOKIE)?.value
  const session = verifyOperatorSession(token, config.secret)
  if (!session || session.operatorId !== config.operatorId) return <OperatorLoginForm />

  return (
    <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4 border-b border-acid-lime/30 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl uppercase leading-none">Mizan Ledger</h1>
            <span className="border border-acid-lime/30 px-2 py-1 text-[10px] font-mono uppercase">Operator-authenticated</span>
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Persisted financial events, evidence-backed reconciliation, and verified summaries
          </p>
          <p className="max-w-3xl text-sm text-muted-ink">
            Only persisted events marked verified contribute to gross receipts and deductions. Pending,
            disputed, and reversed records remain visible but are not presented as realized revenue.
            Amounts are shown in currency minor units without inferred FX conversion.
          </p>
        </header>
        <FinancialLedger />
      </div>
    </main>
  )
}
