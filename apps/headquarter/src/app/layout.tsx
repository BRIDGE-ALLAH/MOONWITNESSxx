import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '../components/AppShell'

export const metadata: Metadata = {
  title: 'MOONWITNESS — See More. Know More.',
  description: 'When the Moon rises, we share messages. An evidence-first observatory for discovery, knowledge, and human understanding.',
  applicationName: 'MOONWITNESS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-ui antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
