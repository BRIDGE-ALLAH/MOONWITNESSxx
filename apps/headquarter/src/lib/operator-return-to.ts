/** Resolve a post-login destination without allowing protocol-relative or backslash URL escapes. */
export function safeOperatorReturnTo(value: string | undefined, publicOrigin: string, fallback = '/riot-radar'): string {
  if (!value) return fallback
  try {
    const destination = new URL(value, publicOrigin)
    const trusted = new URL(publicOrigin)
    if (destination.origin !== trusted.origin) return fallback
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return fallback
  }
}
