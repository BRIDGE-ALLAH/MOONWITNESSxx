export const productLifecycleStates = ['brief', 'production', 'review', 'ready', 'listed', 'retired'] as const

export type ProductLifecycleState = typeof productLifecycleStates[number]

const allowedTransitions: Record<ProductLifecycleState, readonly ProductLifecycleState[]> = {
  brief: ['production', 'retired'],
  production: ['review', 'retired'],
  review: ['production', 'retired'],
  // READY is derived from inspections; asset/version mutations perform rework resets.
  // Operators may retire a ready product, but cannot manually set it back to production.
  ready: ['retired'],
  // LISTED is derived exclusively from a verified publication receipt.
  listed: ['retired'],
  retired: [],
}

export function canTransitionProductLifecycle(
  current: ProductLifecycleState,
  next: ProductLifecycleState,
): boolean {
  return allowedTransitions[current].includes(next)
}

export function nextProductLifecycleStates(current: ProductLifecycleState): ProductLifecycleState[] {
  return [...allowedTransitions[current]]
}
