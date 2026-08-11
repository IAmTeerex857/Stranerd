import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { curateImportedFlashcards, curateImportedQuestions, MATERIALS_EDITORIAL_VERSION, plainMaterialText } from './materialsEditorial.js'

describe('materials flashcard editorial policy', () => {
  it('collapses twins into a plain, deterministic learner card while preserving provenance', () => {
    const provenance = { section: 'Hypertension', source_page: 23, subject: 'cardiovascular-system', tags: ['definition'] }
    const basic = { ...provenance, id: 'basic-id', type: 'basic', front: 'What is Hypertension?', back: 'Persistent elevation of blood pressure above 140/90 mmHg.' }
    const cloze = { ...provenance, id: 'cloze-id', type: 'cloze', front: '{{c1::Hypertension}}: Persistent elevation of blood pressure above 140/90 mmHg.', back: 'Hypertension' }
    const result = curateImportedFlashcards([basic, cloze])
    expect(result).toEqual([{
      ...basic,
      type: 'basic',
      front: 'Which term matches this description? Persistent elevation of blood pressure above 140/90 mmHg.',
      back: 'Hypertension',
    }])
    expect(MATERIALS_EDITORIAL_VERSION).toBe('materials-2026-08-11-v2')
  })

  it('rejects generic labels, fragments, and malformed mnemonics', () => {
    const definition = (term: string, back: string) => ({ id: term, type: 'basic', front: `What is ${term}?`, back, section: 'Context', source_page: 1, subject: 'test', tags: ['definition'] })
    const mnemonic = (front: string, back: string) => ({ id: front, type: 'basic', front: `Recall the mnemonic: ${front}`, back, section: 'Heart anatomy', source_page: 1, subject: 'test', tags: ['mnemonic'] })
    expect(curateImportedFlashcards([
      definition('Definition', 'A contextless extraction.'),
      definition('A', 'A single-letter list fragment.'),
      mnemonic('Useful Mnemonics', 'artery), Mitral and Aortic'),
      mnemonic('Mnemonic: incomplete,', '"ABC" helps remember anatomy.'),
    ])).toEqual([])
  })

  it('characterizes the full corpus and retains only clean, unique cards', async () => {
    const outputRoot = path.resolve('Materials/output')
    const subjects = (await readdir(outputRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    const raw = (await Promise.all(subjects.map(async (subject) => JSON.parse(await readFile(path.join(outputRoot, subject, 'flashcards.json'), 'utf8')) as Record<string, unknown>[]))).flat()
    const curated = curateImportedFlashcards(raw)
    expect(raw).toHaveLength(16_433)
    expect(curated).toHaveLength(6_354)
    expect(curated.filter((card) => (card.tags as string[]).includes('definition'))).toHaveLength(6_043)
    expect(curated.filter((card) => (card.tags as string[]).includes('mnemonic'))).toHaveLength(311)

    const faces = curated.flatMap((card) => [String(card.front), String(card.back)])
    expect(faces.some((face) => /\{\{c\d+::|\[\.{3}\]|(?:^|\s)#{1,6}\s|(?:^|;)\s*(?:[-+*•▪◦]|\d+[.)])\s|(?:\*\*|__|`)/m.test(face))).toBe(false)
    expect(faces.some((face) => /What is (?:Definition|Examples?|Characteristics?|Functions?|Treatments?)\?/i.test(face))).toBe(false)
    expect(curated.every((card) => typeof card.id === 'string' && Number.isInteger(card.source_page) && typeof card.subject === 'string')).toBe(true)
    const keys = curated.map((card) => `${String(card.front).normalize('NFKC').toLowerCase()}\u001f${String(card.back).normalize('NFKC').toLowerCase()}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('materials question editorial policy', () => {
  it('normalizes markup without stripping medically meaningful Unicode', () => {
    expect(plainMaterialText('**β-thalassaemia:** ≥15° at 1.73 m²')).toBe('β-thalassaemia: ≥15° at 1.73 m²')
  })

  async function corpus() {
    const outputRoot = path.resolve('Materials/output')
    const subjects = (await readdir(outputRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    const questions = (await Promise.all(subjects.map(async (subject) => {
      const raw = JSON.parse(await readFile(path.join(outputRoot, subject, 'tests.generated.json'), 'utf8')) as Record<string, unknown>[]
      return curateImportedQuestions(raw)
    }))).flat()
    return { questions, subjects }
  }

  it('retains a clean, valid 20-question set for every subject', async () => {
    const { questions, subjects } = await corpus()
    expect(subjects).toHaveLength(22)
    expect(questions).toHaveLength(440)
    for (const subject of subjects) expect(questions.filter((item) => item.subject === subject)).toHaveLength(20)

    const normalizedQuestions = questions.map((item) => String(item.question).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    expect(new Set(normalizedQuestions).size).toBe(questions.length)
    for (const item of questions) {
      const options = item.options as Record<string, string>
      expect(Object.keys(options).sort()).toEqual(['A', 'B', 'C', 'D'])
      expect(new Set(Object.values(options).map((value) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim())).size).toBe(4)
      expect(['A', 'B', 'C', 'D']).toContain(item.answer)
      expect(options[String(item.answer)]).toBeTruthy()
      expect(item.question).toMatch(/\?$/)
    }

    const learnerText = questions.flatMap((item) => [String(item.question), String(item.explanation), ...Object.values(item.options as Record<string, string>)])
    expect(learnerText.some((value) => /\{\{c\d+::|\[\.{3}\]|(?:^|\s)#{1,6}\s|(?:^|;\s*)(?:[-+*•▪◦]|\d+[.)])\s|(?:\*\*|__|`|~~)|<[^>]+>/m.test(value))).toBe(false)
    expect(learnerText.some((value) => /\b(?:according to (?:the|this) source|source-grounded|source-(?:recommended|described|listed)|listed in (?:the|this) source|(?:the|this) source (?:states|lists|describes|identifies|recommends|specifies|directs)|in the source|source terminology|source criteria|source description)\b/i.test(value))).toBe(false)
    expect(questions.find((item) => item.id === 'mcq-urinary-renal-system-012')?.question).toContain('m²')
    expect(questions.find((item) => item.id === 'mcq-emergency-medicine-019')?.question).toContain('°')
    expect(questions.find((item) => item.id === 'mcq-clinical-hematology-018')?.question).toContain('β')
  })

  it('locks all clinically reviewed question corrections', async () => {
    const byId = new Map((await corpus()).questions.map((item) => [String(item.id), item]))
    const expected: Record<string, { question: string; answer: string; answerText: string; explanation: string }> = {
      'mcq-clinical-hematology-018': { question: 'favors β-thalassaemia trait over α-thalassaemia trait?', answer: 'A', answerText: 'Elevated HbA₂', explanation: 'electrophoresis may be normal in α-thalassaemia trait' },
      'mcq-immunology-rheumatology-020': { question: 'anti-inflammatory effect of low-dose methotrexate in rheumatoid arthritis?', answer: 'A', answerText: 'Increased extracellular adenosine signaling after inhibition of AICAR transformylase', explanation: 'does not fully describe its antirheumatic action' },
      'mcq-nervous-system-011': { question: 'What is the current classification?', answer: 'C', answerText: 'Focal impaired-awareness seizure', explanation: 'replaces the older term complex partial seizure' },
      'mcq-emergency-medicine-010': { question: 'which additional test can assess for xanthochromia?', answer: 'B', answerText: 'Lumbar puncture with cerebrospinal-fluid analysis', explanation: 'more than 6 hours after onset' },
      'mcq-emergency-medicine-016': { question: 'Which treatment combination is appropriate?', answer: 'A', answerText: 'Dexamethasone plus nebulized epinephrine with observation', explanation: 'Corticosteroid treatment is indicated for croup of any severity' },
      'mcq-emergency-medicine-020': { question: 'What is the appropriate next approach?', answer: 'B', answerText: 'Defer lumbar puncture, obtain urgent neuroimaging, and do not delay indicated empiric treatment', explanation: 'should not be delayed' },
      'mcq-mental-health-psychiatry-020': { question: 'Which immediate disposition is most appropriate?', answer: 'D', answerText: 'Maintain a safe setting and arrange emergency psychiatric assessment for inpatient hospitalization', explanation: 'imminent high risk' },
      'mcq-respiratory-system-012': { question: 'Which initial imaging test is generally preferred?', answer: 'D', answerText: 'Computed tomography pulmonary angiography', explanation: 'when iodinated contrast is suitable' },
      'mcq-cardiovascular-system-009': { question: 'Which immediate electrical treatment is indicated?', answer: 'A', answerText: 'Synchronized cardioversion', explanation: 'Pulseless ventricular fibrillation or ventricular tachycardia instead requires unsynchronized defibrillation' },
      'mcq-endocrine-system-017': { question: 'What should happen before insulin infusion begins?', answer: 'A', answerText: 'Replace potassium and defer insulin until serum potassium is above 3.5 mmol/L', explanation: 'can precipitate dangerous hypokalaemia' },
      'mcq-clinical-ophthalmology-017': { question: 'What is the best immediate management?', answer: 'A', answerText: 'Place a rigid eye shield, avoid pressure, keep the patient fasting, give indicated systemic antibiotics and tetanus prophylaxis, and obtain urgent ophthalmology care', explanation: 'urgent ophthalmologic surgical evaluation' },
      'mcq-clinical-ophthalmology-002': { question: 'Which measurement does keratometry provide when evaluating corneal astigmatism?', answer: 'A', answerText: 'Anterior corneal curvature in principal meridians', explanation: 'does not by itself measure posterior corneal effects' },
      'mcq-musculoskeletal-system-018': { question: 'Which laboratory pattern is most typical?', answer: 'A', answerText: 'Low phosphate and elevated alkaline phosphatase, with calcium low or normal', explanation: 'calcium is not invariably low' },
      'mcq-urinary-renal-system-008': { question: 'Which statement best describes definitive management planning?', answer: 'D', answerText: 'Ureteroscopy or shock-wave lithotripsy may be appropriate, with selection guided by stone size, location, anatomy, and patient factors', explanation: 'infected obstruction requires urgent drainage' },
      'mcq-obstetrics-gynaecology-014': { question: 'How is this result classified?', answer: 'B', answerText: 'Reactive', explanation: 'at least 15 beats/min lasting at least 15 seconds' },
      'mcq-sexual-and-reproductive-system-002': { question: 'Which substance in prostatic fluid contributes to semen liquefaction after ejaculation?', answer: 'B', answerText: 'Prostate-specific antigen', explanation: 'most of the alkaline buffering and fructose in semen comes from the seminal vesicles' },
    }
    expect([...byId.keys()].filter((id) => id in expected)).toHaveLength(16)
    for (const [id, regression] of Object.entries(expected)) {
      const item = byId.get(id)
      expect(item, id).toBeDefined()
      expect(String(item?.question), id).toContain(regression.question)
      expect(item?.answer, id).toBe(regression.answer)
      expect((item?.options as Record<string, string>)[regression.answer], id).toBe(regression.answerText)
      expect(String(item?.explanation), id).toContain(regression.explanation)
    }
  })

  it('keeps the seven overlapping objective clusters distinct', async () => {
    const byId = new Map((await corpus()).questions.map((item) => [String(item.id), String(item.question)]))
    const distinctObjectives: Record<string, string> = {
      'mcq-clinical-investigations-002': 'Which association measure',
      'mcq-clinical-investigations-011': 'Which predictive-value change',
      'mcq-medical-genetics-020': 'Which DNA lesion',
      'mcq-medical-genetics-007': 'Which treatment mechanism',
      'mcq-cardiovascular-system-015': 'which vessels are opacified',
      'mcq-nervous-system-012': 'classified as which emergency',
      'mcq-cardiovascular-system-009': 'tachyarrhythmia with a pulse',
    }
    for (const [id, objective] of Object.entries(distinctObjectives)) expect(byId.get(id), id).toContain(objective)
  })
})
