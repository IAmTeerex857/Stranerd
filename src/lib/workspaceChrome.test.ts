// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadDesktopMentorOpen, loadSidebarCollapsed, saveDesktopMentorOpen, saveSidebarCollapsed } from './workspaceChrome'

describe('workspace chrome preferences', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses expanded defaults and restores collapsed choices', () => {
    expect(loadSidebarCollapsed()).toBe(false)
    expect(loadDesktopMentorOpen()).toBe(true)
    saveSidebarCollapsed(true)
    saveDesktopMentorOpen(false)
    expect(loadSidebarCollapsed()).toBe(true)
    expect(loadDesktopMentorOpen()).toBe(false)
  })
})
