import { OperatorLoginForm } from '../../features/money-maker/operator-login-form'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams
  return <OperatorLoginForm returnTo={returnTo || '/riot-radar'} />
}
