export const productLifecycleStates = ['brief', 'production', 'review', 'ready', 'listed', 'retired'] as const

export type ProductLifecycleState = typeof productLifecycleStates[number]

const allowedTransitions: Record<ProductLifecycleState, readonly ProductLifecycleState[]> = {
  brief: ['production'],
  production: ['review'],
  review: ['production', 'ready'],
  ready: ['production', 'listed'],
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
