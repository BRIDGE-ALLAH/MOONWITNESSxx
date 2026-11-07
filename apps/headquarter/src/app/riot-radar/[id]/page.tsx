import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { OpportunityReview } from '../../../features/money-maker/opportunity-review'
import { OperatorLoginForm } from '../../../features/money-maker/operator-login-form'
import {
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  verifyOperatorSession,
} from '../../../lib/operator-session'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PageProps = { params: Promise<{ id: string }> }

export default async function OpportunityReviewPage({ params }: PageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const config = getOperatorSessionConfig()
  if (!config) {
    return (
      <main className="min-h-[70vh] bg-obsidian p-8 text-paper-bone">
        <div role="alert" className="mx-auto max-w-2xl border border-red-500/50 p-6">
          <h1 className="font-display text-2xl uppercase">Operator access unavailable</h1>
          <p className="mt-3 text-sm text-muted-ink">Configure the server-side operator identity, password, session secret and public HTTPS origin.</p>
        </div>
      </main>
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(OPERATOR_SESSION_COOKIE)?.value
  const session = verifyOperatorSession(token, config.secret)
  if (!session || session.operatorId !== config.operatorId) {
    return <OperatorLoginForm returnTo={'/riot-radar/' + id} />
  }

  return <OpportunityReview opportunityId={id} />
}
