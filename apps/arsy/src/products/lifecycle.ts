export const productLifecycleStates = ['brief', 'production', 'review', 'ready', 'listed', 'retired'] as const

export type ProductLifecycleState = typeof productLifecycleStates[number]

const allowedTransitions: Record<ProductLifecycleState, readonly ProductLifecycleState[]> = {
  brief: ['production', 'retired'],
  production: ['review', 'retired'],
  review: ['production', 'retired'],
  // READY is derived exclusively from the latest four passing inspections.
  ready: ['retired'],
  // LISTED is derived exclusively from a recorded publication receipt.
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
