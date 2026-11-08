export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__
}

export async function invoke<T = any>(cmd: string, args?: any): Promise<T> {
  if (!isTauri()) throw new Error('not-tauri')
  return (window as any).__TAURI__.invoke(cmd, args)
}

declare global {
  interface Window {
    __TAURI__?: { invoke(cmd: string, args?: any): Promise<any> }
  }
}
