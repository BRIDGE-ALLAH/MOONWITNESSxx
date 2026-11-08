import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MOONWITNESS COCKPIT — Real-Time NOC & Telemetry',
  description: 'Operations Flight Deck for MOONWITNESS Infrastructure, Telemetry, and Actions',
  applicationName: 'MOONWITNESS COCKPIT',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-mono bg-slate-950 text-slate-100 select-none">
        {children}
      </body>
    </html>
  )
}
