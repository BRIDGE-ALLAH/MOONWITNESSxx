import React from 'react'
import { GateNavbar } from '../components/GateNavbar'
import { UniverseCard, UniverseExperience } from '../components/UniverseCard'

const EXPERIENCES: UniverseExperience[] = [
  {
    id: 'gate',
    number: '01',
    name: 'GATE',
    classification: 'Core Application',
    role: 'Public entrance, orientation, discovery, and navigation across the MOONWITNESS universe.',
    status: 'active',
    statusLabel: 'Operational Portal',
    boundary: 'apps/gate — Public Gateway',
    href: '#',
  },
  {
    id: 'dock',
    number: '02',
    name: 'DOCK',
    classification: 'Core Application',
    role: 'Community, participation, member activity, and shared collaborative spaces.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'apps/dock — Community Domain',
  },
  {
    id: 'headquarter',
    number: '03',
    name: 'HEADQUARTER',
    classification: 'Core Application',
    role: 'Strategic command, governance, portfolio, approvals, and executive oversight.',
    status: 'degraded',
    statusLabel: 'Prototype Active',
    boundary: 'apps/headquarter — Command Engine',
    href: 'http://localhost:3000',
  },
  {
    id: 'id',
    number: '04',
    name: 'MOONWITNESS ID',
    classification: 'Core Application',
    role: 'Human and service identity experience, account and session management, access visibility.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Shared Identity / Auth Authority',
  },
  {
    id: 'observatory',
    number: '05',
    name: 'WORLD OBSERVATORY',
    classification: 'Core Application',
    role: 'Research, observations, evidence, source context, and knowledge discovery.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Research & Knowledge Fabric',
  },
  {
    id: 'moonsky',
    number: '06',
    name: 'MOONSKY',
    classification: 'Core Application',
    role: 'Communication experience: channels, conversations, routing, and verifiable delivery.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Messaging & Signal Network',
  },
  {
    id: 'harbor',
    number: '07',
    name: 'HARBOR',
    classification: 'Core Application',
    role: 'Authenticated E-ISP subscriber portal: account, service, usage, billing, and support.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Subscriber Operations Domain',
  },
  {
    id: 'cockpit',
    number: '08',
    name: 'COCKPIT',
    classification: 'Operational Application',
    role: 'Real-time NOC and infrastructure operations, dispatch, telemetry, and operator actions.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Infrastructure Telemetry Domain',
  },
  {
    id: 'e-isp',
    number: '09',
    name: 'E-ISP STOREFRONT',
    classification: 'Industry Application',
    role: 'Public ISP storefront: connectivity plans, coverage, registration, and acquisition.',
    status: 'target',
    statusLabel: 'Target Experience',
    boundary: 'Public Connectivity Storefront',
  },
]

export default function GateHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 lg:p-16">
      <GateNavbar />

      <section className="max-w-7xl mx-auto w-full my-12">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
            <span>&bull;</span>
            <span>WHEN THE MOON RISES, WE SHARE MESSAGES</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            The Public Gateway to Evidence-First Intelligence
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed font-sans">
            Explore the nine distinct product experiences of the MOONWITNESS ecosystem. Each
            experience operates under explicit domain boundaries and shared verifiable trust
            contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXPERIENCES.map((exp) => (
            <UniverseCard key={exp.id} experience={exp} />
          ))}
        </div>
      </section>

      <footer className="max-w-7xl mx-auto w-full border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
        <div>MOONWITNESS Universe Registry &bull; Architecture Baseline 1.0</div>
        <div>BRIDGE-ALLAH / RIOTWORKS DIVISION</div>
      </footer>
    </main>
  )
}
