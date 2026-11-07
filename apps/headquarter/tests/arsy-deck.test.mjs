import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ARSY_DECK_DEMO_SNAPSHOT } from '../src/features/arsy-deck/demo-data.ts'

test('ARSY DECK fixture is explicitly disclosed as synthetic demo content', () => {
  assert.equal(ARSY_DECK_DEMO_SNAPSHOT.source, 'demo')
  assert.match(ARSY_DECK_DEMO_SNAPSHOT.disclosure, /sample only/i)
  assert.match(ARSY_DECK_DEMO_SNAPSHOT.disclosure, /not connected/i)
})

test('ARSY DECK fixture identifiers are unique within every collection', () => {
  for (const collection of Object.values(ARSY_DECK_DEMO_SNAPSHOT).filter(Array.isArray)) {
    const ids = collection.map((item) => item.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('sample opportunity confidence values stay within percentage bounds', () => {
  for (const opportunity of ARSY_DECK_DEMO_SNAPSHOT.opportunities) {
    assert.ok(opportunity.confidence >= 0 && opportunity.confidence <= 100)
  }
})

test('demo agent states cannot be mistaken for production health enums', () => {
  for (const agent of ARSY_DECK_DEMO_SNAPSHOT.agents) {
    assert.ok(['sample-active', 'sample-idle'].includes(agent.state))
  }
})
