export function safeReturnPath(value: string | null, fallback = '/account') {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback
}

export function loginPath(next = `${window.location.pathname}${window.location.search}${window.location.hash}`) {
  return `/login?next=${encodeURIComponent(safeReturnPath(next, '/app'))}`
}
