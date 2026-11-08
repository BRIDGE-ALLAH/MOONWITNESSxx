import type { SkinDefinition, SkinName } from './types'

export const DEFAULT_SKIN: SkinName = 'observatory'

export const SKIN_REGISTRY = {
  observatory: {
    name: 'observatory',
    label: 'Observatory',
    description: 'A cinematic instrument for observation, research, operations, and decisions.',
    purpose: 'Operate, monitor, compare, research, and decide.',
    avoidFor: ['campaign posters', 'long-form editorial reading when Archive is more appropriate'],
    defaultMode: 'dark',
    supportedModes: ['dark'],
    defaultDensity: 'comfortable',
  },
  archive: {
    name: 'archive',
    label: 'Archive',
    description: 'A warm evidence editorial experience for reading, records, and provenance.',
    purpose: 'Read, preserve, retrieve, compare, and understand records.',
    avoidFor: ['live operational monitoring', 'high-density command workspaces'],
    defaultMode: 'light',
    supportedModes: ['light'],
    defaultDensity: 'comfortable',
  },
  signal: {
    name: 'signal',
    label: 'Signal',
    description: 'An expressive Moonpunk editorial experience for public stories and community.',
    purpose: 'Discover, enter, participate, and share a story.',
    avoidFor: ['dense operational tables', 'finance', 'security and identity settings', 'long transactional forms'],
    defaultMode: 'dark',
    supportedModes: ['dark'],
    defaultDensity: 'comfortable',
  },
} as const satisfies Record<SkinName, SkinDefinition>

export function isSkinName(value: string): value is SkinName {
  return Object.prototype.hasOwnProperty.call(SKIN_REGISTRY, value)
}

export function getSkinDefinition(name: SkinName): SkinDefinition {
  return SKIN_REGISTRY[name]
}
