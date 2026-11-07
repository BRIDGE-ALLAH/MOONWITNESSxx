export const MEMORY_INTEGRITY_ATTACKS = [
  { id: 'content_mutation', category: 'tamper', description: 'Modify a persisted record without using the memory API.' },
  { id: 'record_deletion', category: 'tamper', description: 'Remove a record from the backing store.' },
  { id: 'record_reordering', category: 'ordering', description: 'Reorder records while preserving their contents.' },
  { id: 'record_replay', category: 'replay', description: 'Insert an old valid record a second time.' },
  { id: 'record_forgery', category: 'forgery', description: 'Insert a fabricated record with a plausible identifier.' },
  { id: 'whole_store_rollback', category: 'rollback', description: 'Restore an older genuine snapshot of the entire store.' },
  { id: 'head_metadata_tamper', category: 'tamper', description: 'Alter stored sequence or head digest metadata.' },
  { id: 'scope_transplant', category: 'scope', description: 'Copy a valid record into another tenant or repository scope.' },
  { id: 'revocation_backup_restore', category: 'erasure', description: 'Restore a backup containing a record explicitly revoked or erased.' },
  { id: 'signature_stripping', category: 'forgery', description: 'Remove or replace a record signature while retaining content.' }
] as const
export type MemoryIntegrityAttackId = typeof MEMORY_INTEGRITY_ATTACKS[number]['id']
export type IntegrityDetectionPoint = 'read' | 'audit' | 'none'
export type IntegrityVerdict = 'blocked_at_read' | 'blocked_without_read_detection' | 'blocked_without_signal' | 'served_then_flagged' | 'served_after_detection' | 'served_undetected' | 'control_passed' | 'control_false_alarm'
export interface MemoryIntegrityTrial { caseId: string; attackId: MemoryIntegrityAttackId | 'control_pristine'; attacked: boolean; served: boolean; detectedAt: IntegrityDetectionPoint }
export interface ScoredMemoryIntegrityTrial extends MemoryIntegrityTrial { verdict: IntegrityVerdict; score: number }
export interface MemoryIntegrityBenchmarkReport {
  version: 1; totalTrials: number; attackTrials: number; controlTrials: number; blockedAtRead: number
  detectedOnlyAtAudit: number; blockedWithoutSignal: number; undetectedAttacks: number; falseAlarms: number; score: number
  trials: ScoredMemoryIntegrityTrial[]
}

/** Read-time refusal scores 1; post-serve audit detection scores 0.5; undetected serving scores 0. */
export function scoreMemoryIntegrityBenchmark(trials: readonly MemoryIntegrityTrial[]): MemoryIntegrityBenchmarkReport {
  if (!trials.length) throw new Error('at least one benchmark trial is required')
  const ids = new Set<string>()
  for (const trial of trials) {
    if (!trial.caseId.trim() || ids.has(trial.caseId)) throw new Error('caseId must be unique and non-empty')
    ids.add(trial.caseId)
    if (trial.attacked !== (trial.attackId !== 'control_pristine')) throw new Error('attackId and attacked flag disagree')
    if (!['read', 'audit', 'none'].includes(trial.detectedAt)) throw new Error('invalid detection point')
  }
  const scored: ScoredMemoryIntegrityTrial[] = trials.map((trial) => {
    let verdict: IntegrityVerdict, score: number
    if (!trial.attacked) { verdict = trial.served && trial.detectedAt === 'none' ? 'control_passed' : 'control_false_alarm'; score = verdict === 'control_passed' ? 1 : 0 }
    else if (!trial.served && trial.detectedAt === 'read') { verdict = 'blocked_at_read'; score = 1 }
    else if (!trial.served && trial.detectedAt === 'audit') { verdict = 'blocked_without_read_detection'; score = 0.5 }
    else if (!trial.served && trial.detectedAt === 'none') { verdict = 'blocked_without_signal'; score = 0 }
    else if (trial.served && trial.detectedAt === 'audit') { verdict = 'served_then_flagged'; score = 0.5 }
    else if (trial.served && trial.detectedAt === 'read') { verdict = 'served_after_detection'; score = 0 }
    else { verdict = 'served_undetected'; score = 0 }
    return { ...trial, verdict, score }
  })
  const attacks = scored.filter((t) => t.attacked), controls = scored.filter((t) => !t.attacked)
  return {
    version: 1, totalTrials: trials.length, attackTrials: attacks.length, controlTrials: controls.length,
    blockedAtRead: attacks.filter((t) => t.verdict === 'blocked_at_read').length,
    detectedOnlyAtAudit: attacks.filter((t) => t.verdict === 'blocked_without_read_detection' || t.verdict === 'served_then_flagged').length,
    undetectedAttacks: attacks.filter((t) => t.verdict === 'served_undetected').length,
    falseAlarms: controls.filter((t) => t.verdict === 'control_false_alarm').length,
    score: scored.reduce((sum, t) => sum + t.score, 0) / scored.length, trials: scored
  }
}
