import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import { AppShell } from '../components/AppShell'

export const metadata: Metadata = {
  title: 'MOONWITNESS // RIOTWORKS',
  description: 'Creative Commerce Engine — MAKE WORK THAT OUTLIVES THE FEED.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-ui antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}

