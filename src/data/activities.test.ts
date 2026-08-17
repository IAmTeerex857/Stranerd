import { describe, expect, it } from 'vitest'
import { activityActionMatches, anatomyActivities } from './activities'
import { anatomyModels, modelById } from './models'

describe('anatomy activities', () => {
  it('provides one launchable dissection activity for every anatomy model', () => {
    expect(new Set(anatomyActivities.map((activity) => activity.modelId))).toEqual(new Set(anatomyModels.map((model) => model.id)))
    for (const activity of anatomyActivities) {
      const model = modelById(activity.modelId)
      expect(model.viewer === 'segmented-body' || model.variants.some((variant) => variant.segmentedSystem)).toBe(true)
      expect(activity.steps.length).toBeGreaterThanOrEqual(5)
      const questions = activity.steps.filter((step) => step.kind === 'question')
      const actions = activity.steps.filter((step) => step.kind === 'action')
      expect(questions.length).toBeGreaterThanOrEqual(2)
      expect(questions.every((step) => step.options.length === 4 && new Set(step.options).size === 4)).toBe(true)
      expect(actions.every((step) => step.targetIds.length > 0)).toBe(true)
    }
  })

  it('uses observable structure actions for the whole-body activity', () => {
    const wholeBody = anatomyActivities.find((activity) => activity.modelId === 'anatomy')!
    expect(wholeBody.steps.filter((step) => step.kind === 'action').map((step) => step.action)).toEqual(['select', 'isolate', 'move'])
    expect(wholeBody.steps[0]).toMatchObject({ kind: 'action', targetIds: ['anatomy:skeleton:femur-left'] })
  })

  it('provides a guided educational sequence for every anatomy activity', () => {
    const guided = anatomyActivities.filter((activity) => activity.guided)
    expect(guided).toHaveLength(anatomyActivities.length)
    expect(guided.every((activity) => activity.steps.some((step) => step.kind === 'question'))).toBe(true)
    const pancreas = guided.find((activity) => activity.id === 'pancreas-pathway')!
    expect(pancreas.steps.filter((step) => step.kind === 'action').map((step) => step.action)).toEqual(['hide', 'isolate', 'select'])
  })

  it('validates the exact action verb, exact target set, and activating direction', () => {
    const fade = anatomyActivities.find((activity) => activity.modelId === 'lungs')!.steps[2]
    expect(activityActionMatches(fade, 'transparent', ['anatomy:organs:trachea'])).toBe(true)
    expect(activityActionMatches(fade, 'isolate', ['anatomy:organs:trachea'])).toBe(false)
    expect(activityActionMatches(fade, 'transparent', ['anatomy:organs:left-main-bronchus'])).toBe(false)
    expect(activityActionMatches(fade, 'transparent', ['anatomy:organs:trachea', 'anatomy:organs:left-main-bronchus'])).toBe(false)
    expect(activityActionMatches(fade, 'transparent', ['anatomy:organs:trachea'], false)).toBe(false)
  })
})
