'use client'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-xl border-destructive/50">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">System // Recovery</p>
          <CardTitle>Something went wrong.</CardTitle>
          <CardDescription>
            This view could not be loaded. No internal error details are shown here.
            Try again, or return to the command center if the problem continues.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <p className="text-xs text-muted-foreground" role="status">If you contact support, include the diagnostic reference shown in your browser logs.</p>
        </CardContent>
      </Card>
    </main>
  )
}
