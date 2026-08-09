import { ArrowLeft, ArrowRight, Check, Hand, Route } from 'lucide-react'
import { anatomyActivities, type AnatomyActivity } from '../data/activities'
import { modelById } from '../data/models'
import { digestiveDissectionQuiz } from '../data/dissection'

type Props = {
  mode: 'catalog' | 'manual' | 'guided'
  activeActivityId?: string
  modelId: string
  onGuided: (activity: AnatomyActivity) => void
  onManual: (modelId: string) => void
  onCatalog: () => void
  guidedStep: number | null
  quizChoice?: number
  quizPassed?: boolean
  onStartGuide: () => void
  onQuizChoice: (choice: number) => void
  onQuizCheck: () => void
  onStepContinue: () => void
}

export function DissectionActivitiesView({ mode, activeActivityId, modelId, onGuided, onManual, onCatalog, guidedStep, quizChoice, quizPassed, onStartGuide, onQuizChoice, onQuizCheck, onStepContinue }: Props) {
  const active = anatomyActivities.find((activity) => activity.id === activeActivityId)

  if (mode === 'manual') {
    const model = modelById(modelId)
    return <section className="content-view dissection-activity-view anim">
      <button className="library-back" onClick={onCatalog}><ArrowLeft size={14} />Back to Lab</button>
      <div className="view-title"><span className="eyebrow">Manual dissection</span><h1>Explore {model.name} freely.</h1><p>Select structures in the viewer, then hide, fade, isolate, or move them without a guided objective.</p></div>
      <div className="lab-mode-note"><Hand size={18} /><div><strong>No active objective</strong><p>Your dissection state is saved locally. Choose a guided activity when you want structured checkpoints.</p></div></div>
    </section>
  }

  if (mode === 'guided' && active) {
    const guideComplete = guidedStep === active.steps.length
    const currentStep = guidedStep === null ? undefined : active.steps[guidedStep]
    return <section className="content-view dissection-activity-view anim">
      <button className="library-back" onClick={onCatalog}><ArrowLeft size={14} />Back to Lab</button>
      <div className="view-title"><span className="eyebrow">Active Lab</span><h1>{active.title}</h1><p>{active.description}</p></div>
      <div className="activity-objectives">{active.steps.map((step, index) => <div key={`${step.prompt}-${index}`} className={guidedStep !== null && index < guidedStep ? 'complete' : ''}><span>{String(index + 1).padStart(2, '0')}</span><p>{step.prompt}</p>{guidedStep !== null && index < guidedStep && <Check size={14} />}</div>)}</div>
      <section className={`activity-runner ${guideComplete ? 'complete' : ''}`}>
        {guidedStep === null && <><span>Lab briefing</span><h2>{active.title}</h2><p>Identify structures, answer anatomy questions, and manipulate the model. Each completed checkpoint unlocks the next.</p><button className="primary" onClick={onStartGuide}>Start guided Lab<ArrowRight size={15} /></button></>}
        {currentStep?.kind === 'action' && <><span>Model action · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.prompt}</h2><p>Complete this action in the 3D viewer. Stranerd advances only after the required action and target are validated.</p></>}
        {currentStep?.kind === 'question' && <><span>Knowledge check · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.question}</h2><fieldset>{currentStep.options.map((option, index) => <label key={option}><input type="radio" name={`activity-step-${guidedStep}`} checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset>{quizPassed === undefined ? <button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button> : <><div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{currentStep.explanation}</p></div>{quizPassed && <button className="primary" onClick={onStepContinue}>Continue<ArrowRight size={15} /></button>}</>}</>}
        {guideComplete && active.modelId === 'digestive-system' && <><span>Sequence complete</span><h2>Pathway check</h2><p>{digestiveDissectionQuiz.question}</p><fieldset>{digestiveDissectionQuiz.options.map((option, index) => <label key={option}><input type="radio" name="activity-quiz" checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset><button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button>{quizPassed !== undefined && <div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{digestiveDissectionQuiz.explanation}</p></div>}</>}
        {guideComplete && active.modelId !== 'digestive-system' && <><span>Lab complete</span><h2>Learning sequence completed</h2><p>You identified anatomy, answered the knowledge checks, and completed the model interactions.</p></>}
      </section>
    </section>
  }

  return <section className="content-view dissection-activity-view lab-catalog-view anim">
    <div className="view-title"><span className="eyebrow">Anatomy Lab</span><h1>Learn by revealing structure.</h1><p>Choose guided checkpoints or open any supported specimen in manual dissection mode.</p></div>
    <div className="activity-catalog">{anatomyActivities.map((activity) => {
      const model = modelById(activity.modelId)
      return <article key={activity.id}><span>{model.name}</span><h2>{activity.title}</h2><p>{activity.description}</p><footer><b>{activity.steps.length} guided checkpoints</b><div><button onClick={() => onManual(activity.modelId)}><Hand size={14} />Manual</button><button onClick={() => onGuided(activity)}><Route size={14} />Guided<ArrowRight size={14} /></button></div></footer></article>
    })}</div>
  </section>
}
