import Link from 'next/link'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-riot-orange">404 // Signal lost</p>
          <CardTitle>Route not found.</CardTitle>
          <CardDescription>The requested destination does not exist or is not currently available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/">Return to Headquarter</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}
