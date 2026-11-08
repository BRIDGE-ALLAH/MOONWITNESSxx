'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  addReleaseRepository,
  createLocalReleaseTag,
  getReleasePreview,
  listReleaseDrafts,
  listReleaseHistory,
  listReleaseRepositories,
  removeReleaseRepository,
  saveReleaseDraft,
  listReleaseBuildProfiles,
  runReleaseBuild,
  listReleaseBuildHistory,
  listArtifactCandidates,
  importReleaseArtifact,
  listReleaseVault,
  type ReleaseBuildProfile,
  type ReleaseBuildRecord,
  type ArtifactCandidate,
  type VaultArtifact,
  type ReleaseDraft,
  type ReleaseHistory,
  type ReleasePreview,
  type ReleaseRepository,
} from '../lib/riotRelease'
import { isTauri } from '../lib/tauri'

function nextPatchVersion(latestTag: string | null): string {
  if (!latestTag) return '0.1.0'
  const match = latestTag.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return '0.1.0'
  return match[1] + '.' + match[2] + '.' + (Number(match[3]) + 1)
}

function providerLabel(remoteUrl: string | null): string {
  if (!remoteUrl) return 'NO ORIGIN'
  if (remoteUrl.toLowerCase().includes('github.com')) return 'GITHUB REMOTE'
  if (remoteUrl.toLowerCase().includes('gitlab.com')) return 'GITLAB REMOTE'
  return 'CUSTOM REMOTE'
}

function downloadMarkdown(notes: string, version: string): void {
  const blob = new Blob([notes], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'release-notes-' + (version || 'draft') + '.md'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function RiotReleaseWorkspace() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    setDesktop(isTauri())
  }, [])
  const [repositories, setRepositories] = useState<ReleaseRepository[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [pathInput, setPathInput] = useState('')
  const [preview, setPreview] = useState<ReleasePreview | null>(null)
  const [drafts, setDrafts] = useState<ReleaseDraft[]>([])
  const [history, setHistory] = useState<ReleaseHistory[]>([])
  const [buildProfiles, setBuildProfiles] = useState<ReleaseBuildProfile[]>([])
  const [selectedBuildProfile, setSelectedBuildProfile] = useState('')
  const [buildHistory, setBuildHistory] = useState<ReleaseBuildRecord[]>([])
  const [artifactCandidates, setArtifactCandidates] = useState<ArtifactCandidate[]>([])
  const [vaultArtifacts, setVaultArtifacts] = useState<VaultArtifact[]>([])
  const [confirmBuild, setConfirmBuild] = useState(false)
  const [version, setVersion] = useState('0.1.0')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmTag, setConfirmTag] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!desktop) return
    let active = true
    void listReleaseRepositories()
      .then((items) => {
        if (!active) return
        setRepositories(items)
        if (items.length > 0) setSelectedPath(items[0].path)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      active = false
    }
  }, [desktop])

  useEffect(() => {
    if (!desktop || !selectedPath) {
      setPreview(null)
      setDrafts([])
      setHistory([])
      setBuildProfiles([])
      setSelectedBuildProfile('')
      setBuildHistory([])
      setArtifactCandidates([])
      setVaultArtifacts([])
      setConfirmBuild(false)
      return
    }
    let active = true
    setError('')
    void Promise.all([
      getReleasePreview(selectedPath),
      listReleaseDrafts(selectedPath),
      listReleaseHistory(selectedPath),
      listReleaseBuildProfiles(selectedPath),
      listReleaseBuildHistory(selectedPath),
      listReleaseVault(selectedPath),
    ])
      .then(([nextPreview, nextDrafts, nextHistory, nextBuildProfiles, nextBuildHistory, nextVaultArtifacts]) => {
        if (!active) return
        setPreview(nextPreview)
        setDrafts(nextDrafts)
        setHistory(nextHistory)
        setBuildProfiles(nextBuildProfiles)
        setSelectedBuildProfile((current) => nextBuildProfiles.some((profile) => profile.id === current) ? current : nextBuildProfiles[0]?.id ?? '')
        setBuildHistory(nextBuildHistory)
        setVaultArtifacts(nextVaultArtifacts)
        setVersion(nextPatchVersion(nextPreview.status.latestTag))
        setNotes(nextPreview.suggestedChangelog)
        setConfirmTag(false)
      })
      .catch((reason: unknown) => {
        if (active) {
          setPreview(null)
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })
    return () => {
      active = false
    }
  }, [desktop, selectedPath])

  async function refreshSelectedRepository(): Promise<void> {
    if (!selectedPath) return
    const [nextPreview, nextDrafts, nextHistory, nextBuildProfiles, nextBuildHistory, nextVaultArtifacts] = await Promise.all([
      getReleasePreview(selectedPath),
      listReleaseDrafts(selectedPath),
      listReleaseHistory(selectedPath),
      listReleaseBuildProfiles(selectedPath),
      listReleaseBuildHistory(selectedPath),
      listReleaseVault(selectedPath),
    ])
    setPreview(nextPreview)
    setDrafts(nextDrafts)
    setHistory(nextHistory)
    setBuildProfiles(nextBuildProfiles)
    setBuildHistory(nextBuildHistory)
    setSelectedBuildProfile((current) => nextBuildProfiles.some((profile) => profile.id === current) ? current : nextBuildProfiles[0]?.id ?? '')
    setVaultArtifacts(nextVaultArtifacts)
  }

  async function handleAddRepository(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setFeedback('')
    setBusy(true)
    try {
      const repository = await addReleaseRepository(pathInput)
      setRepositories((current) => [
        repository,
        ...current.filter((item) => item.path !== repository.path),
      ])
      setPathInput('')
      setSelectedPath(repository.path)
      setFeedback('Added local repository: ' + repository.name)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveRepository(path: string): Promise<void> {
    setError('')
    setBusy(true)
    try {
      await removeReleaseRepository(path)
      const next = repositories.filter((item) => item.path !== path)
      setRepositories(next)
      if (selectedPath === path) setSelectedPath(next[0]?.path ?? '')
      setFeedback('Removed from the COCKPIT list. Files on disk were not changed.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!selectedPath) return
    setError('')
    setFeedback('')
    setBusy(true)
    try {
      const saved = await saveReleaseDraft(selectedPath, version, notes)
      setDrafts((current) => [saved, ...current])
      setFeedback('Release draft saved locally in COCKPIT application data.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTag(): Promise<void> {
    if (!selectedPath) return
    setError('')
    setFeedback('')
    setBusy(true)
    try {
      const record = await createLocalReleaseTag(selectedPath, version, notes)
      setConfirmTag(false)
      await refreshSelectedRepository()
      setFeedback('Created local annotated tag ' + record.tag + ' at ' + record.commitSha.slice(0, 8) + '. Nothing was pushed or published.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setConfirmTag(false)
      try {
        await refreshSelectedRepository()
      } catch {
        // Keep the original operation error visible.
      }
    } finally {
      setBusy(false)
    }
  }

  function loadDraft(draft: ReleaseDraft): void {
    setVersion(draft.tag)
    setNotes(draft.notes)
    setConfirmTag(false)
    setFeedback('Loaded saved local draft: ' + draft.tag)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 md:p-8">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            COCKPIT / SOFTWARE LIFECYCLE
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">RIOT RELEASE</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Local release desk. Git history, changelog drafts, and annotated tags stay on this machine.
          </p>
        </div>
        <a
          href="/"
          className="inline-flex min-h-[42px] items-center justify-center rounded border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-xs text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200"
        >
          &larr; OPERATIONS FLIGHT DECK
        </a>
      </header>

      {!desktop ? (
        <div className="mb-6 rounded border border-amber-700/60 bg-amber-950/30 p-4 text-sm text-amber-100">
          Desktop runtime required. Open COCKPIT through its Tauri desktop build to access local filesystem and Git. This page does not fall back to browser storage or network services.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mb-4 rounded border border-rose-700/60 bg-rose-950/30 p-3 font-mono text-xs text-rose-200">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div role="status" className="mb-4 rounded border border-emerald-700/50 bg-emerald-950/20 p-3 font-mono text-xs text-emerald-200">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Repo Fleet</h2>
              <span className="font-mono text-[10px] text-slate-500">{repositories.length} LOCAL</span>
            </div>
            <form onSubmit={handleAddRepository} className="space-y-2">
              <label htmlFor="riot-release-path" className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Working directory path
              </label>
              <input
                id="riot-release-path"
                value={pathInput}
                onChange={(event) => setPathInput(event.target.value)}
                placeholder="C:\workspace\project"
                disabled={!desktop || busy}
                className="min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none transition focus:border-amber-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!desktop || busy || !pathInput.trim()}
                className="min-h-11 w-full rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 font-mono text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'WORKING…' : '+ ADD LOCAL REPOSITORY'}
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {repositories.length === 0 ? (
                <p className="rounded border border-dashed border-slate-700 p-3 text-xs text-slate-500">
                  No repositories registered. Add an existing Git working directory; COCKPIT will not clone or move it.
                </p>
              ) : (
                repositories.map((repository) => (
                  <div
                    key={repository.path}
                    className={'rounded border p-2 ' + (selectedPath === repository.path ? 'border-amber-500/60 bg-amber-500/10' : 'border-slate-800 bg-slate-950/70')}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPath(repository.path)}
                      className="block w-full text-left"
                      disabled={busy}
                    >
                      <div className="truncate font-mono text-xs font-bold text-slate-100">{repository.name}</div>
                      <div className="mt-1 break-all text-[10px] text-slate-500">{repository.path}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveRepository(repository.path)}
                      disabled={busy}
                      className="mt-2 text-[10px] font-mono text-rose-300 hover:text-rose-200 disabled:opacity-40"
                    >
                      REMOVE FROM LIST
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Provider boundary</h2>
            <p className="text-xs leading-5 text-slate-400">
              Origin remotes are inspected locally. GitHub/GitLab authentication, release publication, mirrors, and remote storage are optional online extensions and are not called by this workflow.
            </p>
            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-slate-500">
              NETWORK REQUIRED: NO
            </div>
          </section>
        </aside>

        <main className="min-w-0 space-y-6">
          {!selectedPath || !preview ? (
            <section className="flex min-h-72 flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
              <div className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Release workspace idle</div>
              <p className="mt-2 max-w-lg text-sm text-slate-500">Register a local Git repository to inspect commits and prepare an offline release draft.</p>
            </section>
          ) : (
            <>
              <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Selected repository</div>
                    <h2 className="mt-1 text-xl font-bold text-white">{preview.status.name}</h2>
                    <p className="mt-1 break-all text-xs text-slate-500">{preview.status.path}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={'rounded border px-2 py-1 font-mono text-[10px] ' + (preview.status.clean ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300' : 'border-amber-700/60 bg-amber-950/30 text-amber-200')}>
                      {preview.status.clean ? 'WORKTREE CLEAN' : 'UNCOMMITTED CHANGES'}
                    </span>
                    <span className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-400">
                      {providerLabel(preview.status.remoteUrl)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="font-mono text-[10px] text-slate-500">BRANCH</div>
                    <div className="mt-1 truncate font-mono text-sm text-cyan-200">{preview.status.branch}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="font-mono text-[10px] text-slate-500">HEAD</div>
                    <div className="mt-1 truncate font-mono text-sm text-slate-200">{preview.status.headSha.slice(0, 12)}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="font-mono text-[10px] text-slate-500">LATEST REACHABLE TAG</div>
                    <div className="mt-1 truncate font-mono text-sm text-slate-200">{preview.status.latestTag ?? 'NO TAG'}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="font-mono text-[10px] text-slate-500">COMMITS SINCE TAG</div>
                    <div className="mt-1 font-mono text-sm text-slate-200">{preview.commits.length}</div>
                  </div>
                </div>
                <div className="mt-3 break-all rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-slate-500">
                  ORIGIN: {preview.status.remoteUrl ?? 'not configured'}
                </div>
              </section>

              <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                <div className="rounded border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Release notes editor</h2>
                    <button type="button" onClick={() => downloadMarkdown(notes, version)} className="font-mono text-[10px] text-cyan-300 hover:text-cyan-100">EXPORT .MD</button>
                  </div>
                  <label htmlFor="riot-release-version" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-slate-500">Next version (SemVer)</label>
                  <input
                    id="riot-release-version"
                    value={version}
                    onChange={(event) => { setVersion(event.target.value); setConfirmTag(false) }}
                    className="mb-3 min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-400"
                    placeholder="1.2.3"
                    disabled={busy}
                  />
                  <label htmlFor="riot-release-notes" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-slate-500">Editable Markdown changelog</label>
                  <textarea
                    id="riot-release-notes"
                    value={notes}
                    onChange={(event) => { setNotes(event.target.value); setConfirmTag(false) }}
                    rows={16}
                    className="w-full select-text resize-y rounded border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-amber-400"
                    disabled={busy}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleSaveDraft()} disabled={busy || !notes.trim()} className="min-h-11 rounded border border-slate-600 bg-slate-800 px-4 py-2 font-mono text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-40">
                      SAVE LOCAL DRAFT
                    </button>
                    {!confirmTag ? (
                      <button type="button" onClick={() => setConfirmTag(true)} disabled={busy || !preview.status.clean || !notes.trim()} className="min-h-11 rounded border border-amber-500/60 bg-amber-500/10 px-4 py-2 font-mono text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-40">
                        PREPARE LOCAL TAG
                      </button>
                    ) : (
                      <button type="button" onClick={() => void handleCreateTag()} disabled={busy} className="min-h-11 rounded border border-rose-500/60 bg-rose-500/10 px-4 py-2 font-mono text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40">
                        CONFIRM CREATE {version.startsWith('v') ? version : 'v' + version}
                      </button>
                    )}
                  </div>
                  {confirmTag ? (
                    <p className="mt-3 rounded border border-amber-700/60 bg-amber-950/20 p-3 text-xs text-amber-100">
                      This creates an annotated tag in the selected local repository only. It does not push, publish, overwrite an existing tag, or modify remote services.
                    </p>
                  ) : null}
                  {!preview.status.clean ? (
                    <p className="mt-3 text-xs text-amber-200">Commit or otherwise resolve local changes before creating a release tag. Drafts can still be saved.</p>
                  ) : null}
                </div>

                <div className="space-y-6">
                  <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
                    <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Commit intelligence</h2>
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {preview.commits.length === 0 ? (
                        <p className="text-xs text-slate-500">No commits since the latest reachable tag.</p>
                      ) : (
                        preview.commits.map((commit) => (
                          <article key={commit.sha} className="border-b border-slate-800 pb-2 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] text-amber-300">{commit.category}</span>
                              <span className="font-mono text-[10px] text-slate-600">{commit.shortSha}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-200">{commit.subject}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{commit.author} · {commit.committedAt}</p>
                          </article>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
                    <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Saved local drafts</h2>
                    {drafts.length === 0 ? (
                      <p className="text-xs text-slate-500">No saved drafts for this repository.</p>
                    ) : (
                      <div className="space-y-2">
                        {drafts.map((draft) => (
                          <button key={draft.id} type="button" onClick={() => loadDraft(draft)} className="block w-full rounded border border-slate-800 bg-slate-950 p-3 text-left hover:border-amber-500/50">
                            <span className="font-mono text-xs font-bold text-amber-200">{draft.tag}</span>
                            <span className="mt-1 block font-mono text-[10px] text-slate-500">HEAD {draft.targetSha.slice(0, 12)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded border border-slate-800 bg-slate-900/70 p-4">
                    <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-slate-300">Local release history</h2>
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-500">No local release tags recorded by COCKPIT yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((entry) => (
                          <article key={entry.id} className="rounded border border-slate-800 bg-slate-950 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-emerald-300">{entry.tag}</span>
                              <span className="font-mono text-[10px] text-slate-600">LOCAL ONLY</span>
                            </div>
                            <p className="mt-1 font-mono text-[10px] text-slate-500">{entry.commitSha.slice(0, 12)}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4 font-mono text-[10px] text-slate-600">
        <span>RIOT RELEASE / LOCAL CORE / NO CLOUD DEPENDENCY</span>
        <span>MOONWITNESS · RIOTWORKS</span>
      </footer>
    </div>
  )
}
