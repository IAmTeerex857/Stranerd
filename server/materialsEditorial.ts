type FlashcardRecord = Record<string, unknown>
type QuestionRecord = Record<string, unknown>

type QuestionOverride = {
  question: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export const MATERIALS_EDITORIAL_VERSION = 'materials-2026-08-11-v2'

const CLOZE_RE = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g
const GENERIC_LABEL_RE = /^(?:definition|examples?|characteristics?|functions?|treatments?|components?|features?|causes?|symptoms?|signs?|diagnosis|management|prevention|complications?|types?|classification|mechanism|indications?|contraindications?|uses?|risk factors?|investigations?|description|overview|purpose|importance|properties|clinical features|formula|note|key|advantages?|disadvantages?|benefits?|limitations?|structure|location|roles?|process|steps?|principles?|interpretation|findings?|outcomes?|effects?|actions?)$/i
const LIST_MARKER_RE = /^\s*(?:[-+*•▪◦]\s+|\d{1,3}[.)]\s+)/

const QUESTION_OVERRIDES: Record<string, QuestionOverride> = {
  'mcq-clinical-hematology-018': {
    question: 'A patient has persistent microcytosis, normal iron stores, and suspected thalassaemia trait. Which haemoglobin-analysis result favors β-thalassaemia trait over α-thalassaemia trait?',
    options: { A: 'Elevated HbA₂', B: 'An isolated prolonged aPTT', C: 'A positive direct antiglobulin test', D: 'An elevated D-dimer' },
    answer: 'A',
    explanation: 'Elevated HbA₂ supports β-thalassaemia trait. Haemoglobin electrophoresis may be normal in α-thalassaemia trait, so a normal result does not exclude it and molecular testing may be needed when confirmation is important.',
  },
  'mcq-immunology-rheumatology-020': {
    question: 'Which mechanism is most closely associated with the anti-inflammatory effect of low-dose methotrexate in rheumatoid arthritis?',
    options: { A: 'Increased extracellular adenosine signaling after inhibition of AICAR transformylase', B: 'Direct cyclooxygenase inhibition', C: 'Selective depletion of CD20-positive B cells', D: 'Irreversible blockade of Janus kinases' },
    answer: 'A',
    explanation: 'At the low weekly doses used for rheumatoid arthritis, methotrexate promotes anti-inflammatory adenosine signaling, in part through AICAR transformylase inhibition. Dihydrofolate reductase inhibition is important at higher antiproliferative doses but does not fully describe its antirheumatic action.',
  },
  'mcq-nervous-system-011': {
    question: 'A seizure begins in one cerebral hemisphere and impairs awareness. What is the current classification?',
    options: { A: 'Focal aware seizure', B: 'Generalized absence seizure', C: 'Focal impaired-awareness seizure', D: 'Generalized atonic seizure' },
    answer: 'C',
    explanation: 'A seizure with focal onset and impaired awareness is classified as a focal impaired-awareness seizure. This replaces the older term complex partial seizure.',
  },
  'mcq-emergency-medicine-010': {
    question: 'A neurologically intact patient presents 12 hours after a sudden thunderclap headache. Non-contrast head CT is negative, but clinical suspicion for subarachnoid haemorrhage remains high. If there is no contraindication, which additional test can assess for xanthochromia?',
    options: { A: 'Electroencephalography', B: 'Lumbar puncture with cerebrospinal-fluid analysis', C: 'Skull radiography', D: 'Carotid Doppler ultrasonography' },
    answer: 'B',
    explanation: 'The sensitivity of non-contrast CT declines with time. When presentation is more than 6 hours after onset and suspicion remains after a negative CT, cerebrospinal-fluid analysis is an accepted additional investigation; CT angiography is an alternative in some pathways.',
  },
  'mcq-emergency-medicine-016': {
    question: 'A child has a barking cough, stridor at rest, and moderate respiratory distress from croup. Which treatment combination is appropriate?',
    options: { A: 'Dexamethasone plus nebulized epinephrine with observation', B: 'A short-acting bronchodilator alone', C: 'Antibiotics plus chest physiotherapy', D: 'No treatment because croup is self-limiting' },
    answer: 'A',
    explanation: 'Corticosteroid treatment is indicated for croup of any severity. Stridor at rest or moderate to severe distress also warrants nebulized epinephrine followed by observation for recurrent symptoms.',
  },
  'mcq-emergency-medicine-020': {
    question: 'A patient with suspected bacterial meningitis has papilloedema and a focal neurological deficit. What is the appropriate next approach?',
    options: { A: 'Perform lumbar puncture immediately', B: 'Defer lumbar puncture, obtain urgent neuroimaging, and do not delay indicated empiric treatment', C: 'Discharge the patient without investigation', D: 'Perform lumbar puncture through any available skin site' },
    answer: 'B',
    explanation: 'Papilloedema and a focal deficit raise concern for an intracranial mass effect. Neuroimaging should precede lumbar puncture, while blood cultures and indicated empiric antimicrobial treatment should not be delayed.',
  },
  'mcq-mental-health-psychiatry-020': {
    question: 'A patient in an acute suicidal crisis has current intent, access to lethal means, and cannot maintain safety. Which immediate disposition is most appropriate?',
    options: { A: 'Routine outpatient review in one month', B: 'Leave the patient alone while awaiting collateral history', C: 'Discharge with written educational material only', D: 'Maintain a safe setting and arrange emergency psychiatric assessment for inpatient hospitalization' },
    answer: 'D',
    explanation: 'Current intent, access to lethal means, and inability to maintain safety indicate imminent high risk. The patient requires continuous safety measures, urgent psychiatric assessment, and hospitalization, using applicable emergency legal procedures if voluntary admission is not possible.',
  },
  'mcq-respiratory-system-012': {
    question: 'A hemodynamically stable, nonpregnant adult has a high clinical probability of pulmonary embolism and no contraindication to iodinated contrast. Which initial imaging test is generally preferred?',
    options: { A: 'Plain chest radiography', B: 'Transthoracic echocardiography', C: 'High-resolution CT without angiography', D: 'Computed tomography pulmonary angiography' },
    answer: 'D',
    explanation: 'Computed tomography pulmonary angiography is generally the preferred initial imaging test in a stable patient with likely pulmonary embolism when iodinated contrast is suitable. Other pathways are used when contrast or radiation is unsuitable or the patient is unstable.',
  },
  'mcq-cardiovascular-system-009': {
    question: 'A patient has a tachyarrhythmia with a pulse that is causing hypotension and altered mental status. Which immediate electrical treatment is indicated?',
    options: { A: 'Synchronized cardioversion', B: 'Unsynchronized defibrillation for every rhythm', C: 'Elective catheter ablation', D: 'Vagal maneuvers despite ongoing instability' },
    answer: 'A',
    explanation: 'A tachyarrhythmia with a pulse causing hemodynamic instability requires synchronized cardioversion. Pulseless ventricular fibrillation or ventricular tachycardia instead requires unsynchronized defibrillation.',
  },
  'mcq-endocrine-system-017': {
    question: 'A patient with diabetic ketoacidosis has received initial fluid resuscitation. The serum potassium is 3.1 mmol/L. What should happen before insulin infusion begins?',
    options: { A: 'Replace potassium and defer insulin until serum potassium is above 3.5 mmol/L', B: 'Start insulin immediately without potassium replacement', C: 'Give sodium bicarbonate as the only treatment', D: 'Restrict fluids until the glucose normalizes' },
    answer: 'A',
    explanation: 'Insulin shifts potassium into cells and can precipitate dangerous hypokalaemia. With potassium below 3.5 mmol/L, potassium should be replaced and insulin deferred until the potassium is above that threshold, with frequent monitoring.',
  },
  'mcq-clinical-ophthalmology-017': {
    question: 'After ocular trauma, a patient has marked visual loss, an irregular pupil, and suspected open-globe injury. What is the best immediate management?',
    options: { A: 'Place a rigid eye shield, avoid pressure, keep the patient fasting, give indicated systemic antibiotics and tetanus prophylaxis, and obtain urgent ophthalmology care', B: 'Measure intraocular pressure repeatedly', C: 'Patch the eye tightly and discharge the patient', D: 'Remove any protruding foreign body at the bedside' },
    answer: 'A',
    explanation: 'Suspected open-globe injury requires protection with a rigid shield, avoidance of ocular pressure or manipulation, fasting, control of pain and vomiting, indicated systemic antibiotics and tetanus prophylaxis, and urgent ophthalmologic surgical evaluation.',
  },
  'mcq-clinical-ophthalmology-002': {
    question: 'Which measurement does keratometry provide when evaluating corneal astigmatism?',
    options: { A: 'Anterior corneal curvature in principal meridians', B: 'Retinal nerve-fiber thickness', C: 'Anterior chamber pressure', D: 'Total refractive error from the entire optical system' },
    answer: 'A',
    explanation: 'Keratometry measures anterior corneal curvature in the principal meridians and estimates corneal astigmatism. It does not by itself measure posterior corneal effects or the eye’s complete refractive error.',
  },
  'mcq-musculoskeletal-system-018': {
    question: 'A child has bowed legs and widened growth plates due to nutritional vitamin D-deficiency rickets. Which laboratory pattern is most typical?',
    options: { A: 'Low phosphate and elevated alkaline phosphatase, with calcium low or normal', B: 'High phosphate and suppressed alkaline phosphatase', C: 'Persistently high calcium with low parathyroid hormone', D: 'Monoclonal immunoglobulin with normal alkaline phosphatase' },
    answer: 'A',
    explanation: 'Nutritional vitamin D-deficiency rickets typically causes low phosphate and elevated alkaline phosphatase. Secondary hyperparathyroidism can keep serum calcium within the reference range, so calcium is not invariably low.',
  },
  'mcq-urinary-renal-system-008': {
    question: 'A stable adult has a symptomatic 12-mm proximal ureteric stone without sepsis. Which statement best describes definitive management planning?',
    options: { A: 'Observation is always sufficient regardless of stone size', B: 'Antibiotics alone will remove the stone', C: 'Treatment is determined without considering stone location', D: 'Ureteroscopy or shock-wave lithotripsy may be appropriate, with selection guided by stone size, location, anatomy, and patient factors' },
    answer: 'D',
    explanation: 'A 12-mm symptomatic ureteric stone is unlikely to pass reliably. Ureteroscopy and shock-wave lithotripsy are potential treatments, but the choice depends on stone size and location, urinary anatomy, available expertise, and patient factors; infected obstruction requires urgent drainage.',
  },
  'mcq-obstetrics-gynaecology-014': {
    question: 'At 34 weeks’ gestation, a non-stress test shows two fetal heart-rate accelerations of at least 15 beats/min above baseline, each lasting at least 15 seconds, within 20 minutes. How is this result classified?',
    options: { A: 'Positive', B: 'Reactive', C: 'Nonreactive', D: 'Negative contraction stress test' },
    answer: 'B',
    explanation: 'At 32 weeks or later, at least two accelerations of at least 15 beats/min lasting at least 15 seconds within 20 minutes constitute a reactive non-stress test. Positive and negative terminology applies to contraction stress testing.',
  },
  'mcq-sexual-and-reproductive-system-002': {
    question: 'Which substance in prostatic fluid contributes to semen liquefaction after ejaculation?',
    options: { A: 'Fructose', B: 'Prostate-specific antigen', C: 'Human chorionic gonadotropin', D: 'Surfactant protein' },
    answer: 'B',
    explanation: 'The prostate contributes prostate-specific antigen and other proteolytic enzymes that help liquefy semen. Prostatic fluid is slightly acidic; most of the alkaline buffering and fructose in semen comes from the seminal vesicles.',
  },
  'mcq-clinical-investigations-002': {
    question: 'Researchers select people with a rare cancer and matched controls, then compare prior occupational exposures. Which association measure should they calculate?',
    options: { A: 'Prevalence ratio', B: 'Odds ratio', C: 'Incidence rate from direct follow-up', D: 'Number needed to treat' },
    answer: 'B',
    explanation: 'This is a case-control design, for which the odds ratio estimates the exposure-disease association. Unlike a cohort study, it does not directly estimate incidence or risk.',
  },
  'mcq-clinical-investigations-011': {
    question: 'A diagnostic test retains the same sensitivity and specificity when moved to a population with higher disease prevalence. Which predictive-value change is generally expected?',
    options: { A: 'Positive predictive value decreases', B: 'Negative predictive value decreases', C: 'Sensitivity necessarily increases', D: 'Specificity necessarily decreases' },
    answer: 'B',
    explanation: 'As prevalence rises, a negative result is less likely to be a true negative, so negative predictive value generally decreases. Positive predictive value generally increases, while sensitivity and specificity need not change.',
  },
  'mcq-medical-genetics-020': {
    question: 'Which DNA lesion is a characteristic substrate for nucleotide excision repair?',
    options: { A: 'A uracil base created by cytosine deamination', B: 'A single mismatched base after replication', C: 'A clean double-strand break', D: 'A bulky UV-induced pyrimidine dimer' },
    answer: 'D',
    explanation: 'Nucleotide excision repair removes bulky, helix-distorting lesions such as UV-induced pyrimidine dimers. Base excision, mismatch repair, and double-strand-break repair address different lesion classes.',
  },
  'mcq-nervous-system-012': {
    question: 'Continuous convulsive seizure activity lasting more than 5 minutes should be classified as which emergency?',
    options: { A: 'Focal aware seizure', B: 'Psychogenic syncope', C: 'Postictal confusion', D: 'Convulsive status epilepticus' },
    answer: 'D',
    explanation: 'Convulsive seizure activity lasting at least 5 minutes is treated as convulsive status epilepticus because spontaneous cessation becomes less likely and urgent treatment is required.',
  },
  'mcq-cardiovascular-system-015': {
    question: 'When CT pulmonary angiography is performed for suspected pulmonary embolism, which vessels are opacified to identify an intraluminal filling defect?',
    options: { A: 'Coronary arteries', B: 'Carotid arteries', C: 'Pulmonary arteries', D: 'Renal arteries' },
    answer: 'C',
    explanation: 'CT pulmonary angiography times intravenous contrast to opacify the pulmonary arterial tree, where an embolus appears as an intraluminal filling defect.',
  },
  'mcq-clinical-hematology-010': {
    question: 'A hemodynamically stable patient has a low pretest probability of pulmonary embolism and a negative age-adjusted high-sensitivity D-dimer. What is the most appropriate interpretation?',
    options: { A: 'Pulmonary embolism is excluded without immediate chest imaging', B: 'CT pulmonary angiography is mandatory despite the negative result', C: 'Thrombolysis should begin immediately', D: 'A negative D-dimer confirms deep-vein thrombosis' },
    answer: 'A',
    explanation: 'In a stable patient with low or intermediate pretest probability, a negative appropriately sensitive D-dimer can exclude pulmonary embolism without immediate imaging. Positive results require further evaluation rather than establishing the diagnosis alone.',
  },
}

const CORPUS_TEXT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bthe source's\b/gi, 'the'],
  [/\baccording to the source\b/gi, ''],
  [/\bsupported by the source\b/gi, 'supported'],
  [/\blisted in the source\b/gi, ''],
  [/\bdescribed in the source\b/gi, ''],
  [/\bin the source classification\b/gi, ''],
  [/\bin the source\b/gi, ''],
  [/\bsource-grounded\b/gi, ''],
  [/\bsource terminology\b/gi, 'current terminology'],
  [/\bsource-recommended\b/gi, 'recommended'],
  [/\bsource-described\b/gi, 'characteristic'],
  [/\bsource-listed\b/gi, 'established'],
  [/The source specifies multiple blood pressure readings as part of/gi, 'Multiple blood pressure readings are part of'],
  [/The source specifically identifies moisturizers and emollients containing ceramides and hyaluronic acid as aids to restoring and maintaining/gi, 'Moisturizers and emollients containing ceramides and hyaluronic acid help restore and maintain'],
  [/For suspected melanoma, the source recommends an excisional biopsy that includes the entire lesion and a margin of normal skin\./gi, 'For suspected melanoma, an excisional biopsy including the entire lesion and a margin of normal skin is recommended.'],
  [/The source identifies ACE inhibitor-associated non-allergic angioedema as bradykinin-mediated and notes that/gi, 'ACE inhibitor-associated non-allergic angioedema is bradykinin-mediated, and'],
  [/The source describes this as neonatal herpes simplex from vertical transmission and states that/gi, 'This is neonatal herpes simplex from vertical transmission;'],
  [/The source specifically identifies JVP evaluation as/gi, 'JVP evaluation is'],
  [/The source links renal artery bruits with/gi, 'Renal artery bruits may indicate'],
  [/the source specifically cites/gi, 'a clinical example is'],
  [/the source identifies the odds ratio as/gi, 'the odds ratio is'],
  [/the source directs clinicians to/gi, 'initial care includes'],
  [/initial care includes ensure ABCs and perform a focused neurologic examination/gi, 'initial care includes ensuring ABCs and performing a focused neurologic examination'],
  [/meets the source definition of/gi, 'meets the definition of'],
  [/the source identifies appendectomy as/gi, 'appendectomy is'],
  [/The source identifies 21-hydroxylase deficiency as/gi, '21-hydroxylase deficiency is'],
  [/for which the source recommends/gi, 'managed with'],
  [/The source identifies lupus nephritis as/gi, 'Lupus nephritis is'],
  [/the source lists imaging, ESR\/CRP, and HLA-B27 testing in its evaluation/gi, 'evaluation includes imaging, ESR/CRP, and HLA-B27 testing'],
  [/The source identifies acyclovir as/gi, 'Acyclovir is'],
  [/The source identifies rifampin, isoniazid, pyrazinamide, and ethambutol as/gi, 'Rifampin, isoniazid, pyrazinamide, and ethambutol are'],
  [/The source contrasts avascular cartilage with richly vascular bone;/gi, 'Cartilage is avascular whereas bone is richly vascular;'],
  [/The source distinguishes maternal serum and non-invasive prenatal tests as screening methods, while listing amniocentesis and chorionic villus sampling as diagnostic tests\./gi, 'Maternal serum and non-invasive prenatal tests are screening methods, whereas amniocentesis and chorionic villus sampling are diagnostic tests.'],
  [/This evolution is characteristic of Prader-Willi syndrome, for which the source specifies molecular testing including DNA methylation analysis of chromosome 15\./gi, 'This evolution is characteristic of Prader-Willi syndrome, which is evaluated with molecular testing including DNA methylation analysis of chromosome 15.'],
  [/Under the source's Rotterdam criteria/gi, 'Under the Rotterdam criteria'],
  [/documented by the source criteria/gi, 'indicated by these eGFR criteria'],
  [/described in the source/gi, ''],
  [/Which test is identified as the gold-standard assessment/gi, 'Which test is the definitive anatomical assessment'],
  [/Among the listed evaluations for coronary artery disease/gi, 'For anatomical evaluation of coronary artery disease'],
  [/the other listed choices/gi, 'the other choices'],
  [/Which listed test/gi, 'Which test'],
  [/Which imaging modality is listed for/gi, 'Which imaging modality is used for'],
  [/is the listed initial screening and surveillance modality/gi, 'is used for initial screening and surveillance'],
  [/is listed as a cause of/gi, 'can cause'],
  [/Which topical ingredients are specifically identified as helping restore/gi, 'Which topical ingredients help restore'],
  [/Which biopsy approach best follows the guidance for obtaining a representative specimen/gi, 'Which biopsy approach is most appropriate'],
  [/using the stated normal range/gi, 'using the adult reference range'],
  [/The stated normal adult respiratory rate/gi, 'The adult reference respiratory rate'],
  [/based on the examination guidance/gi, 'for this finding'],
  [/The stated bedside tests/gi, 'Standard bedside tests'],
  [/is identified as the knee test used to assess/gi, 'is used to assess'],
  [/the stated ABCDE approach/gi, 'the ABCDE approach'],
  [/against the stated normal range/gi, 'against the fetal reference range'],
  [/The stated normal fetal heart rate/gi, 'The fetal heart-rate reference range'],
  [/using the pediatric ranges provided/gi, 'using the newborn reference range'],
  [/The provided newborn respiratory range/gi, 'The newborn respiratory reference range'],
  [/below the stated normal range/gi, 'below the reference range'],
  [/contains the listed vessels, nerves, glands, and follicles/gi, 'contains vessels, nerves, glands, and follicles'],
  [/the setting identified for logistic regression/gi, 'the setting for logistic regression'],
  [/Which treatment class is specifically described for recurrent or severe disease/gi, 'Which treatment class is appropriate for recurrent or severe disease'],
  [/Which medication is specifically listed for convulsion management/gi, 'Which medication is indicated for convulsion management'],
  [/magnesium sulfate is listed for management of the convulsions/gi, 'magnesium sulfate is indicated to control convulsions'],
  [/one of the listed screening tests/gi, 'an accepted screening test'],
  [/is the described Whipple triad/gi, 'completes Whipple’s triad'],
  [/Among the listed interleukins/gi, 'Among these interleukins'],
  [/is listed as a type I hypersensitivity reaction/gi, 'is a type I hypersensitivity reaction'],
  [/are the described presentation/gi, 'are the typical presentation'],
  [/Which treatment mechanism is specifically described as reducing crisis frequency/gi, 'Which treatment mechanism reduces crisis frequency'],
  [/which is described as reducing/gi, 'which reduces'],
  [/Which option is identified as a diagnostic test rather than a screening test/gi, 'Which option is a diagnostic test rather than a screening test'],
  [/The described phenotype/gi, 'This phenotype'],
  [/SSRIs are listed as indicated for/gi, 'SSRIs are indicated for'],
  [/The listed lithium adverse effects are/gi, 'Important lithium adverse effects include'],
  [/is the listed infant imaging study/gi, 'is the preferred infant imaging study'],
  [/are listed clinical features/gi, 'are clinical features'],
  [/Which option is listed for severe disease/gi, 'Which intervention is appropriate for severe disease'],
  [/is the surgical option identified for/gi, 'is a surgical option for'],
  [/are the listed aggressive X-ray features/gi, 'are aggressive X-ray features'],
  [/its listed blood tests include/gi, 'appropriate blood tests include'],
  [/is the described presentation/gi, 'is the typical presentation'],
  [/for the listed analyses/gi, 'for cell count, glucose, protein, and culture'],
  [/The other listed methods/gi, 'The other methods'],
  [/the other listed classes/gi, 'the other classes'],
  [/are listed manifestations/gi, 'are manifestations'],
  [/Which newly added medication is specifically identified as increasing warfarin's effect/gi, 'Which newly added medication increases warfarin’s effect'],
  [/is explicitly listed among drugs that increase warfarin's effect/gi, 'can increase warfarin’s effect'],
  [/are listed among common causes/gi, 'are common causes'],
  [/Among the listed COPD measures, smoking cessation is identified as/gi, 'Smoking cessation is'],
  [/contains the listed first-line drugs/gi, 'contains standard first-line drugs'],
  [/is among its listed causes/gi, 'can cause it'],
  [/The described symptoms/gi, 'These symptoms'],
  [/is the stated diagnostic gold standard/gi, 'is a diagnostic criterion'],
  [/is specifically described as beneficial for/gi, 'can benefit'],
  [/Which imaging test is the stated gold standard for the suspected diagnosis/gi, 'Which imaging test is preferred for the suspected diagnosis'],
  [/is the stated diagnostic gold standard/gi, 'is the preferred diagnostic imaging test'],
  [/What is the primary treatment described for a localized tumor/gi, 'What is the primary treatment for a localized tumor'],
  [/among the listed imaging studies used/gi, 'an imaging study used'],
  [/are listed with bladder training and fluid management as/gi, 'are, along with bladder training and fluid management,'],
]

export function plainMaterialText(value: string): string {
  const lines = value
    .replace(/\r/g, '')
    .replace(CLOZE_RE, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*>+\s?/, '').replace(LIST_MARKER_RE, '').trim())
    .filter(Boolean)
  return lines.join('; ')
    .replace(/(?:\*\*\*|___|\*\*|__|\*|_|`|~~)/g, '')
    .replace(/(^|;\s*)\d{1,3}[.)]\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function cleanLabel(value: string): string {
  return plainMaterialText(value)
    .replace(/^\s*(?:[-–—]|\d{1,3}(?:\.\d{1,3})*[.)]?)\s*/, '')
    .replace(/\s*[:.]\s*$/, '')
    .trim()
}

function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}\p{S}]+/gu, ' ').trim()
}

function sensibleLabel(value: string): boolean {
  const words = value.split(/\s+/)
  return value.length >= 2 && value.length <= 100 && words.length <= 14 && !GENERIC_LABEL_RE.test(value) && !/^[A-Za-z]$/.test(value) && !LIST_MARKER_RE.test(value)
}

function sensibleDescription(value: string): boolean {
  const words = value.split(/\s+/)
  return value.length >= 12 && value.length <= 700 && words.length >= 3 && words.length <= 110 && !/[{}]/.test(value) && !/^[:;,.)\]]/.test(value) && !/^(?:and|or|but|because|which|that|with|of|to)\b/i.test(value)
}

function definitionParts(card: FlashcardRecord): { term: string; description: string } | undefined {
  const front = typeof card.front === 'string' ? card.front.trim() : ''
  const back = typeof card.back === 'string' ? card.back.trim() : ''
  if (card.type === 'cloze') {
    const match = front.match(/^\s*\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}\s*:\s*([\s\S]+)$/)
    if (match) return { term: cleanLabel(match[1]), description: plainMaterialText(match[2]) }
  }
  const match = front.match(/^\s*What\s+is\s+([\s\S]+?)\?\s*$/i)
  if (match) return { term: cleanLabel(match[1]), description: plainMaterialText(back) }
  return undefined
}

function curateDefinition(card: FlashcardRecord): FlashcardRecord | undefined {
  const parts = definitionParts(card)
  if (!parts || !sensibleLabel(parts.term) || !sensibleDescription(parts.description)) return undefined
  return {
    ...card,
    type: 'basic',
    front: `Which term matches this description? ${parts.description}`,
    back: parts.term,
  }
}

function curateMnemonic(card: FlashcardRecord): FlashcardRecord | undefined {
  const rawFront = typeof card.front === 'string' ? card.front : ''
  const rawBack = typeof card.back === 'string' ? card.back : ''
  const title = plainMaterialText(rawFront.replace(/^Recall the mnemonic:\s*/i, ''))
  const body = plainMaterialText(rawBack)
  const section = cleanLabel(typeof card.section === 'string' ? card.section : '')
  if (!sensibleLabel(section) || title.length < 4 || title.length > 180 || !sensibleDescription(body) || body.length > 600) return undefined
  if (!/\b(?:mnemonic|remember|remind|stands? for|think of|helps? (?:you )?recall)\b|["“”]/i.test(body)) return undefined
  if (/[,;:]$/.test(title) || /^(?:[a-z]|[),.;:])/u.test(body) || normalized(title) === normalized(body)) return undefined
  const quotes = (title.match(/["“”]/g) ?? []).length
  if (quotes % 2 || (title.match(/\(/g) ?? []).length !== (title.match(/\)/g) ?? []).length) return undefined
  return {
    ...card,
    type: 'basic',
    front: `Which mnemonic helps recall ${section}?`,
    back: body,
  }
}

export function curateImportedFlashcards(cards: FlashcardRecord[], seen = new Set<string>()): FlashcardRecord[] {
  const retained: FlashcardRecord[] = []
  for (const card of cards) {
    const tags = Array.isArray(card.tags) ? card.tags : []
    const curated = tags.includes('mnemonic') ? curateMnemonic(card) : curateDefinition(card)
    if (!curated) continue
    const key = tags.includes('mnemonic') ? `mnemonic\u001f${normalized(String(curated.back))}` : `definition\u001f${normalized(String(curated.front))}\u001f${normalized(String(curated.back))}`
    if (seen.has(key)) continue
    seen.add(key)
    retained.push(curated)
  }
  return retained
}

function cleanQuestionText(value: string): string {
  let cleaned = plainMaterialText(value).normalize('NFC')
  for (const [pattern, replacement] of CORPUS_TEXT_REPLACEMENTS) cleaned = cleaned.replace(pattern, replacement)
  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\bthe characteristic source description of\b/gi, 'characteristic of')
    .trim()
}

export function curateImportedQuestions(questions: QuestionRecord[]): QuestionRecord[] {
  return questions.map((source) => {
    const id = String(source.id)
    const override = QUESTION_OVERRIDES[id]
    const record = override ? { ...source, ...override } : source
    const rawOptions = record.options && typeof record.options === 'object' && !Array.isArray(record.options)
      ? record.options as Record<string, unknown>
      : {}
    const options = Object.fromEntries(Object.entries(rawOptions).map(([key, value]) => [key, cleanQuestionText(String(value))]))
    return {
      ...record,
      question: cleanQuestionText(String(record.question)),
      options,
      explanation: cleanQuestionText(String(record.explanation)),
    }
  })
}
