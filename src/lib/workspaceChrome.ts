const SIDEBAR_KEY = 'stranerd.workspace.sidebar-collapsed.v1'
const MENTOR_KEY = 'stranerd.workspace.mentor-open.v1'

function readBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  return value === 'true' ? true : value === 'false' ? false : fallback
}

export const loadSidebarCollapsed = () => readBoolean(SIDEBAR_KEY, false)
export const loadDesktopMentorOpen = () => readBoolean(MENTOR_KEY, true)

export function saveSidebarCollapsed(value: boolean) {
  window.localStorage.setItem(SIDEBAR_KEY, String(value))
}

export function saveDesktopMentorOpen(value: boolean) {
  window.localStorage.setItem(MENTOR_KEY, String(value))
}
