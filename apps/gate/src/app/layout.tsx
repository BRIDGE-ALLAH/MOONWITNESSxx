import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'MOONWITNESS GATE — Public Entrance & Universe Discovery',
  description:
    'Gateway to the MOONWITNESS universe. Discover platforms, evidence, and community portals.',
  applicationName: 'MOONWITNESS GATE',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
