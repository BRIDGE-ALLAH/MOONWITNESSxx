import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import { AppShell } from '../components/AppShell'

export const metadata: Metadata = {
  title: 'MOONWITNESS — See More. Know More.',
  description: 'When the Moon rises, we share what matters. An evidence-first observatory for discovery, knowledge, and human understanding.',
  applicationName: 'MOONWITNESS',
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
