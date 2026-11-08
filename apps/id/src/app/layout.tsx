import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MOONWITNESS ID — Identity Authority',
  description: 'Centralized authentication, token issuance, and session verification',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  )
}
