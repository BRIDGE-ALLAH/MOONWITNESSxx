import { ARSY_DECK_DEMO_SNAPSHOT } from './demo-data'
import type { ArsyDeckSnapshot } from './types'

export interface ArsyDeckRepository {
  getSnapshot(): Promise<ArsyDeckSnapshot>
}

/**
 * Explicit demo implementation. Replace only after ARSY publishes and tests
 * the workspace-pulse contract; do not infer a live endpoint from this shape.
 */
export const demoArsyDeckRepository: ArsyDeckRepository = {
  async getSnapshot() {
    return ARSY_DECK_DEMO_SNAPSHOT
  },
}

export async function getArsyDeckSnapshot(
  repository: ArsyDeckRepository = demoArsyDeckRepository,
): Promise<ArsyDeckSnapshot> {
  return repository.getSnapshot()
}
