export function safeReturnPath(value: string | null, fallback = '/account') {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return fallback
  try {
    const base = new URL('https://stranerd.local')
    const target = new URL(value, base)
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : fallback
  } catch {
    return fallback
  }
}
