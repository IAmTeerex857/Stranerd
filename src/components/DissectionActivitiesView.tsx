import { ArrowLeft, ArrowRight, Check, Route } from 'lucide-react'
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
    return <section className="content-view dissection-activity-view anim">
      <Button variant="ghost" className="library-back" onClick={onCatalog}><ArrowLeft size={14} />Back to Lab</Button>
      <div className="view-title"><h1>{active.title}</h1><p>{active.description}</p></div>
      <div className="activity-objectives">{active.steps.map((step, index) => <div key={`${step.prompt}-${index}`} className={guidedStep !== null && index < guidedStep ? 'complete' : ''}><span>{String(index + 1).padStart(2, '0')}</span><p>{step.prompt}</p>{guidedStep !== null && index < guidedStep && <Check size={14} />}</div>)}</div>
      <section className={`activity-runner ${guideComplete ? 'complete' : ''}`}>
        {guidedStep === null && <><span>Lab briefing</span><h2>{active.title}</h2><p>Identify structures, answer anatomy questions, and manipulate the model. Each completed checkpoint unlocks the next.</p><Button onClick={onStartGuide}>Start guided Lab<ArrowRight size={15} /></Button></>}
        {currentStep?.kind === 'action' && <><span>Model action · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.prompt}</h2><p>Complete this action in the 3D viewer. Stranerd advances only after the required action and target are validated.</p></>}
        {currentStep?.kind === 'question' && <><span>Knowledge check · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.question}</h2><fieldset>{currentStep.options.map((option, index) => <label key={option}><input type="radio" name={`activity-step-${guidedStep}`} checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset>{quizPassed === undefined ? <Button disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</Button> : <><div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{currentStep.explanation}</p></div>{quizPassed && <Button onClick={onStepContinue}>Continue<ArrowRight size={15} /></Button>}</>}</>}
        {guideComplete && active.modelId === 'digestive-system' && <><span>Sequence complete</span><h2>Pathway check</h2><p>{digestiveDissectionQuiz.question}</p><fieldset>{digestiveDissectionQuiz.options.map((option, index) => <label key={option}><input type="radio" name="activity-quiz" checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset><button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button>{quizPassed !== undefined && <div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{digestiveDissectionQuiz.explanation}</p></div>}</>}
        {guideComplete && active.modelId !== 'digestive-system' && <><span>Lab complete</span><h2>Learning sequence completed</h2><p>You identified anatomy, answered the knowledge checks, and completed the model interactions.</p></>}
      </section>
    </section>
  }

  return <section className="content-view dissection-activity-view lab-catalog-view anim">
    <div className="view-title"><h1>Learn by revealing structure.</h1><p>Choose a guided Lab and complete each validated anatomy checkpoint.</p></div>
    <div className="activity-catalog">{anatomyActivities.map((activity) => {
      const model = modelById(activity.modelId)
      return <Card key={activity.id}><span>{model.name}</span><h2>{activity.title}</h2><p>{activity.description}</p><footer><b>{activity.steps.length} guided checkpoints</b><div><Button onClick={() => onGuided(activity)}><Route size={14} />Start Lab<ArrowRight size={14} /></Button></div></footer></Card>
    })}</div>
  </section>
}
