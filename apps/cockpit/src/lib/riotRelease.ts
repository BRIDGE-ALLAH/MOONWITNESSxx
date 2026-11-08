import { invoke, isTauri } from './tauri.ts'

export interface ReleaseRepository {
  path: string
  name: string
  remoteUrl: string | null
  registeredAtMs: number
}

export interface ReleaseStatus {
  path: string
  name: string
  branch: string
  headSha: string
  clean: boolean
  latestTag: string | null
  remoteUrl: string | null
}

export interface ReleaseCommit {
  sha: string
  shortSha: string
  subject: string
  author: string
  committedAt: string
  category: string
}

export interface ReleasePreview {
  status: ReleaseStatus
  commits: ReleaseCommit[]
  suggestedChangelog: string
}

export interface ReleaseDraft {
  id: string
  repositoryPath: string
  repositoryName: string
  tag: string
  targetSha: string
  notes: string
  createdAtMs: number
}

export interface ReleaseHistory {
  id: string
  repositoryPath: string
  repositoryName: string
  tag: string
  commitSha: string
  notes: string
  createdAtMs: number
  publication: string
}

function requireDesktop(): void {
  if (!isTauri()) {
    throw new Error('Local Git operations require the COCKPIT Tauri desktop application.')
  }
}

export async function listReleaseRepositories(): Promise<ReleaseRepository[]> {
  requireDesktop()
  return invoke<ReleaseRepository[]>('riot_release_list_repositories')
}

export async function addReleaseRepository(path: string): Promise<ReleaseRepository> {
  requireDesktop()
  return invoke<ReleaseRepository>('riot_release_add_repository', { path })
}

export async function removeReleaseRepository(path: string): Promise<void> {
  requireDesktop()
  return invoke<void>('riot_release_remove_repository', { path })
}

export async function getReleasePreview(path: string): Promise<ReleasePreview> {
  requireDesktop()
  return invoke<ReleasePreview>('riot_release_get_preview', { path })
}

export async function saveReleaseDraft(
  path: string,
  version: string,
  notes: string
): Promise<ReleaseDraft> {
  requireDesktop()
  return invoke<ReleaseDraft>('riot_release_save_draft', { path, version, notes })
}

export async function listReleaseDrafts(path?: string): Promise<ReleaseDraft[]> {
  requireDesktop()
  return invoke<ReleaseDraft[]>('riot_release_list_drafts', { path: path ?? null })
}

export async function listReleaseHistory(path?: string): Promise<ReleaseHistory[]> {
  requireDesktop()
  return invoke<ReleaseHistory[]>('riot_release_list_history', { path: path ?? null })
}

export async function createLocalReleaseTag(
  path: string,
  version: string,
  notes: string
): Promise<ReleaseHistory> {
  requireDesktop()
  return invoke<ReleaseHistory>('riot_release_create_local_tag', { path, version, notes })
}
