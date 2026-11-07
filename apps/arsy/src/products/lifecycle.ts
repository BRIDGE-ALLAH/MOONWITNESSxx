export const productLifecycleStates = ['brief', 'production', 'review', 'ready', 'listed', 'retired'] as const

export type ProductLifecycleState = typeof productLifecycleStates[number]

const allowedTransitions: Record<ProductLifecycleState, readonly ProductLifecycleState[]> = {
  brief: ['production'],
  production: ['review'],
  // READY is inspection-derived; it must never be set by a generic lifecycle mutation.
  review: ['production'],
  // LISTED is set only by the publication-receipt workflow.
  ready: ['production', 'retired'],
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
