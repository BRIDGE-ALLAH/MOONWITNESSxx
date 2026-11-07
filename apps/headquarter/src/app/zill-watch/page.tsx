import { cookies } from 'next/headers'
import { ZillWatchBoard } from '../../features/money-maker/zill-watch-board'
import { OperatorLoginForm } from '../../features/money-maker/operator-login-form'
import { getOperatorSessionConfig, OPERATOR_SESSION_COOKIE, verifyOperatorSession } from '../../lib/operator-session'

export const dynamic = 'force-dynamic'

export default async function ZillWatchPage() {
  const config = getOperatorSessionConfig()
  if (!config) return <main className="min-h-[70vh] bg-obsidian p-8 text-paper-bone"><h1 className="font-display text-2xl uppercase">Operator access unavailable</h1><p className="mt-3 text-sm text-muted-ink">Configure Headquarter operator authentication first.</p></main>
  const cookieStore = await cookies()
  const session = verifyOperatorSession(cookieStore.get(OPERATOR_SESSION_COOKIE)?.value, config.secret)
  if (!session || session.operatorId !== config.operatorId) return <OperatorLoginForm />
  return <ZillWatchBoard />
}
