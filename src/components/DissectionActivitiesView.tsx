import { ArrowRight, Check } from 'lucide-react'
import { activityForModel, type AnatomyActivity } from '../data/activities'
import { modelById } from '../data/models'
import { digestiveDissectionQuiz } from '../data/dissection'

type Props = {
  activeActivityId?: string
  modelId: string
  onLaunch: (activity?: AnatomyActivity) => void
  guidedStep: number | null
  quizChoice?: number
  quizPassed?: boolean
  onStartGuide: () => void
  onQuizChoice: (choice: number) => void
  onQuizCheck: () => void
  onStepContinue: () => void
}

export function DissectionActivitiesView({ activeActivityId, modelId, onLaunch, guidedStep, quizChoice, quizPassed, onStartGuide, onQuizChoice, onQuizCheck, onStepContinue }: Props) {
  const currentActivity = activityForModel(modelId)
  const active = currentActivity?.id === activeActivityId ? currentActivity : undefined
  const guideComplete = Boolean(active && guidedStep === active.steps.length)
  const currentStep = active && guidedStep !== null ? active.steps[guidedStep] : undefined
  if (active) return <section className="content-view dissection-activity-view anim">
    <div className="view-title"><span className="eyebrow">Active dissection</span><h1>{active.title}</h1><p>{active.description}</p></div>
    <div className="activity-objectives">{active.steps.map((step, index) => <div key={`${step.prompt}-${index}`} className={guidedStep !== null && index < guidedStep ? 'complete' : ''}><span>{String(index + 1).padStart(2, '0')}</span><p>{step.prompt}</p>{guidedStep !== null && index < guidedStep && <Check size={14} />}</div>)}</div>
    <section className={`activity-runner ${guideComplete ? 'complete' : ''}`}>{guidedStep === null ? <><span>Activity briefing</span><h2>{active.title}</h2><p>Identify structures, answer anatomy questions, and manipulate the model. Each correct checkpoint unlocks the next.</p><button className="primary" onClick={onStartGuide}>Start activity<ArrowRight size={15} /></button></> : guideComplete ? active.modelId === 'digestive-system' ? <><span>Sequence complete</span><h2>Pathway check</h2><p>{digestiveDissectionQuiz.question}</p><fieldset>{digestiveDissectionQuiz.options.map((option, index) => <label key={option}><input type="radio" name="activity-quiz" checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset><button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button>{quizPassed !== undefined && <div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{digestiveDissectionQuiz.explanation}</p></div>}</> : <><span>Activity complete</span><h2>Learning sequence completed</h2><p>You identified anatomy, answered the knowledge checks, and completed the model interactions.</p></> : currentStep?.kind === 'question' ? <><span>Knowledge check · step {guidedStep + 1} of {active.steps.length}</span><h2>{currentStep.question}</h2><fieldset>{currentStep.options.map((option, index) => <label key={option}><input type="radio" name={`activity-step-${guidedStep}`} checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset>{quizPassed === undefined ? <button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button> : <><div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{currentStep.explanation}</p></div>{quizPassed && <button className="primary" onClick={onStepContinue}>Continue activity<ArrowRight size={15} /></button>}</>}<i className="activity-progress"><b style={{ width: `${(guidedStep / active.steps.length) * 100}%` }} /></i></> : <><span>Model task · step {guidedStep + 1} of {active.steps.length}</span><h2>{currentStep?.prompt}</h2><p>{guidedStep > 0 ? active.steps[guidedStep - 1].success : 'Select structures in the model or searchable Dissect panel.'}</p><i className="activity-progress"><b style={{ width: `${(guidedStep / active.steps.length) * 100}%` }} /></i></>}</section>
    <button className="secondary activity-catalog-button" onClick={() => onLaunch()}>Choose another activity</button>
  </section>

  if (!currentActivity) return null
  return <section className="content-view dissection-activity-view anim"><div className="view-title"><span className="eyebrow">{modelById(modelId).name} activity</span><h1>{currentActivity.title}</h1><p>{currentActivity.description}</p></div><div className="activity-catalog"><article><span>{modelById(currentActivity.modelId).name}</span><h2>{currentActivity.title}</h2><p>{currentActivity.description}</p><footer><b>{currentActivity.guided ? 'Guided assessment' : 'Dissection activity'}</b><button onClick={() => onLaunch(currentActivity)}>Launch<ArrowRight size={14} /></button></footer></article></div></section>
}
