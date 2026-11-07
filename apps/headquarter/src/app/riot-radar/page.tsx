import { cookies } from 'next/headers'
import { OpportunityBoard } from '../../features/money-maker/opportunity-board'
import { OperatorLoginForm } from '../../features/money-maker/operator-login-form'
import {
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  verifyOperatorSession,
} from '../../lib/operator-session'

export const dynamic = 'force-dynamic'

export default async function RIOTRadarPage() {
  const config = getOperatorSessionConfig()
  if (!config) {
    return (
      <main className="min-h-[70vh] bg-obsidian p-8 text-paper-bone">
        <div role="alert" className="mx-auto max-w-2xl border border-red-500/50 p-6">
          <h1 className="font-display text-2xl uppercase">Operator access unavailable</h1>
          <p className="mt-3 text-sm text-muted-ink">
            Headquarter operator authentication is not configured. Set the operator ID,
            password, session secret, and public HTTPS origin before using commercial records.
          </p>
        </div>
      </main>
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(OPERATOR_SESSION_COOKIE)?.value
  const session = verifyOperatorSession(token, config.secret)

  if (!session || session.operatorId !== config.operatorId) {
    return <OperatorLoginForm returnTo="/riot-radar" />
  }

  return <OpportunityBoard />
}
