export function safeReturnPath(value: string | null, fallback = '/account') {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback
}
