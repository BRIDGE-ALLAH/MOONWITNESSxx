export default function GateHomePage() {
  const experiences = [
    {
      id: 'headquarter',
      name: 'HEADQUARTER',
      role: 'Strategic command, governance, portfolio, approvals, and executive oversight.',
      status: 'Active Prototype',
      accent: 'border-amber-500/30 text-amber-400',
    },
    {
      id: 'dock',
      name: 'DOCK',
      role: 'Community, participation, member activity, and shared spaces.',
      status: 'Target Experience',
      accent: 'border-blue-500/30 text-blue-400',
    },
    {
      id: 'observatory',
      name: 'WORLD OBSERVATORY',
      role: 'Research, observations, evidence, source context, and knowledge discovery.',
      status: 'Target Experience',
      accent: 'border-emerald-500/30 text-emerald-400',
    },
    {
      id: 'moonsky',
      name: 'MOONSKY',
      role: 'Communication experience: channels, conversations, routing, and delivery.',
      status: 'Target Experience',
      accent: 'border-purple-500/30 text-purple-400',
    },
    {
      id: 'id',
      name: 'MOONWITNESS ID',
      role: 'Human and service identity experience, account and access visibility.',
      status: 'Target Experience',
      accent: 'border-sky-500/30 text-sky-400',
    },
    {
      id: 'cockpit',
      name: 'COCKPIT',
      role: 'Real-time NOC and infrastructure operations, telemetry, and actions.',
      status: 'Target Experience',
      accent: 'border-rose-500/30 text-rose-400',
    },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-16">
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">
            Ecosystem Gateway
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">MOONWITNESS GATE</h1>
        </div>
        <div className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-300">
          EXPERIENCE 01 / 09
        </div>
      </header>

      <section className="max-w-6xl mx-auto w-full my-12">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-mono text-emerald-400 mb-2">
            WHEN THE MOON RISES, WE SHARE MESSAGES.
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            The Public Entrance to the MOONWITNESS Universe
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Discover independent platforms, evidence-backed intelligence systems, and community
            gateways.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition p-6 rounded-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-white font-mono">{exp.name}</h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${exp.accent}`}
                  >
                    {exp.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{exp.role}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Domain Boundary</span>
                <span className="text-slate-200">Protected &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-6xl mx-auto w-full border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-4">
        <div>MOONWITNESS &bull; All experiences connected through explicit contracts</div>
        <div>BRIDGE-ALLAH / RIOTWORKS</div>
      </footer>
    </main>
  )
}
