import { ARSY_DECK_DEMO_SNAPSHOT } from './demo-data'
import type { ArsyDeckSnapshot } from './types'

/**
 * The current ARSY application does not publish a workspace-pulse endpoint.
 * Keep the source explicit and injectable instead of inventing a live API.
 */
export async function getArsyDeckSnapshot(): Promise<ArsyDeckSnapshot> {
  return ARSY_DECK_DEMO_SNAPSHOT
}
