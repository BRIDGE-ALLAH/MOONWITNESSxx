export type DeckMetric = {
  id: string
  label: string
  value: string
  context: string
}

export type DeckOpportunity = {
  id: string
  title: string
  summary: string
  confidence: number
  stage: 'review' | 'research' | 'blocked'
}

export type DeckAgent = {
  id: string
  name: string
  responsibility: string
  state: 'sample-active' | 'sample-idle'
}

export type DeckChannel = {
  id: string
  name: string
  sampleState: string
  tone: 'warning' | 'info' | 'neutral'
}

export type DeckActivity = {
  id: string
  title: string
  description: string
  relativeTime: string
}

export type DeckInsight = {
  id: string
  label: string
  sampleDelta: string
  direction: 'up' | 'down' | 'flat'
}

export type ArsyDeckSnapshot = {
  source: 'demo'
  disclosure: string
  metrics: DeckMetric[]
  opportunities: DeckOpportunity[]
  agents: DeckAgent[]
  channels: DeckChannel[]
  activity: DeckActivity[]
  insights: DeckInsight[]
}
