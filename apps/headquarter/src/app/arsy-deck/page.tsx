import { ArsyDeckView } from '../../features/arsy-deck/arsy-deck-view'
import { getArsyDeckSnapshot } from '../../features/arsy-deck/repository'

export default async function ARSYDeckPage() {
  const snapshot = await getArsyDeckSnapshot()
  return <ArsyDeckView snapshot={snapshot} />
}
