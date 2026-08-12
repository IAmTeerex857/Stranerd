import { ArrowLeft, ArrowRight, CircleDot, Route } from 'lucide-react'
import { anatomyActivities, type AnatomyActivity } from '../data/activities'
import { modelById } from '../data/models'
import { digestiveDissectionQuiz } from '../data/dissection'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Props = {
  mode: 'catalog' | 'guided'
  activeActivityId?: string
  onGuided: (activity: AnatomyActivity) => void
  onCatalog: () => void
  guidedStep: number | null
  quizChoice?: number
  quizPassed?: boolean
  onStartGuide: () => void
  onQuizChoice: (choice: number) => void
  onQuizCheck: () => void
  onStepContinue: () => void
}

export function DissectionActivitiesView({ mode, activeActivityId, onGuided, onCatalog, guidedStep, quizChoice, quizPassed, onStartGuide, onQuizChoice, onQuizCheck, onStepContinue }: Props) {
  const active = anatomyActivities.find((activity) => activity.id === activeActivityId)

  if (mode === 'guided' && active) {
    const guideComplete = guidedStep === active.steps.length
    const currentStep = guidedStep === null ? undefined : active.steps[guidedStep]
    const completedSteps = guidedStep === null ? 0 : Math.min(guidedStep, active.steps.length)
    return <section className="content-view dissection-activity-view lab-runner-view anim">
      <header className="lab-runner-header"><Button variant="ghost" className="library-back" onClick={onCatalog}><ArrowLeft size={14} />All Labs</Button><span>{completedSteps}/{active.steps.length} complete</span></header>
      <div className="lab-runner-title"><span>{modelById(active.modelId).name}</span><h1>{active.title}</h1><p>{active.description}</p></div>
      <div className="lab-step-track" aria-label={`${completedSteps} of ${active.steps.length} checkpoints complete`}>{active.steps.map((step, index) => <i key={`${step.prompt}-${index}`} className={guidedStep !== null && index < guidedStep ? 'complete' : index === guidedStep ? 'current' : ''} />)}</div>
      <section className={`activity-runner ${guideComplete ? 'complete' : ''}`}>
        {guidedStep === null && <><span>Lab briefing</span><h2>Work checkpoint by checkpoint.</h2><p>Use the model to identify structures and perform each exact action. Knowledge checks appear here between model tasks.</p><Button onClick={onStartGuide}>Begin Lab<ArrowRight size={15} /></Button></>}
        {currentStep?.kind === 'action' && <><span>Model action · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.prompt}</h2><div className="lab-action-status"><CircleDot size={15} /><p>Waiting for the exact action and structure in the 3D viewer.</p></div></>}
        {currentStep?.kind === 'question' && <><span>Knowledge check · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.question}</h2><fieldset>{currentStep.options.map((option, index) => <label key={option}><input type="radio" name={`activity-step-${guidedStep}`} checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset>{quizPassed === undefined ? <Button disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</Button> : <><div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{currentStep.explanation}</p></div>{quizPassed && <Button onClick={onStepContinue}>Continue<ArrowRight size={15} /></Button>}</>}</>}
        {guideComplete && active.modelId === 'digestive-system' && <><span>Sequence complete</span><h2>Pathway check</h2><p>{digestiveDissectionQuiz.question}</p><fieldset>{digestiveDissectionQuiz.options.map((option, index) => <label key={option}><input type="radio" name="activity-quiz" checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset><button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button>{quizPassed !== undefined && <div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{digestiveDissectionQuiz.explanation}</p></div>}</>}
        {guideComplete && active.modelId !== 'digestive-system' && <><span>Lab complete</span><h2>Learning sequence completed</h2><p>You identified anatomy, answered the knowledge checks, and completed the model interactions.</p></>}
      </section>
    </section>
  }

  return <section className="content-view dissection-activity-view lab-catalog-view anim">
    <div className="lab-catalog-hero"><div><span>Interactive anatomy Labs</span><h1>Learn by revealing structure.</h1><p>Ten guided practicals pair the 3D specimen with deterministic anatomy checkpoints. Every model action is validated locally against the required structure.</p></div><aside><strong>{String(anatomyActivities.length).padStart(2, '0')}</strong><span>Guided Labs</span></aside></div>
    <div className="activity-catalog">{anatomyActivities.map((activity) => {
      const model = modelById(activity.modelId)
      return <Card key={activity.id}><header><span>{model.name}</span><Route size={16} /></header><h2>{activity.title}</h2><p>{activity.description}</p><footer><b>{activity.steps.length} checkpoints</b><Button onClick={() => onGuided(activity)}>Open Lab<ArrowRight size={14} /></Button></footer></Card>
    })}</div>
  </section>
}
