import { ArrowLeft, ArrowRight, Check, CircleDot, FlaskConical } from 'lucide-react'
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

const activityAccents: Record<string, 'green' | 'red' | 'amber' | 'terracotta'> = {
  'heart-flow': 'red',
  'brain-regions': 'amber',
  'lung-airways': 'green',
  'urinary-pathway': 'amber',
  'eye-optics': 'green',
  'liver-biliary': 'terracotta',
  'pancreas-pathway': 'green',
  'neural-pathways': 'amber',
  'skin-regions': 'terracotta',
  'whole-body-systems': 'red',
}

export function DissectionActivitiesView({ mode, activeActivityId, onGuided, onCatalog, guidedStep, quizChoice, quizPassed, onStartGuide, onQuizChoice, onQuizCheck, onStepContinue }: Props) {
  const active = anatomyActivities.find((activity) => activity.id === activeActivityId)

  if (mode === 'guided' && active) {
    const guideComplete = guidedStep === active.steps.length
    const currentStep = guidedStep === null ? undefined : active.steps[guidedStep]
    const completedSteps = guidedStep === null ? 0 : Math.min(guidedStep, active.steps.length)
    return <section className="content-view dissection-activity-view lab-runner-view anim">
      <header className="lab-runner-header">
        <Button variant="ghost" className="library-back" onClick={onCatalog}><ArrowLeft size={14} />Back to Lab</Button>
        <h1>{active.title}</h1>
      </header>
      <div className="lab-step-list" aria-label={`${completedSteps} of ${active.steps.length} checkpoints complete`}>
        {active.steps.map((step, index) => {
          const complete = guidedStep !== null && index < guidedStep
          const current = index === guidedStep
          return <div key={`${step.prompt}-${index}`} className={complete ? 'complete' : current ? 'current' : 'future'} aria-current={current ? 'step' : undefined}>
            <i>{complete ? <Check size={12} /> : index + 1}</i>
            <span>{step.prompt}</span>
          </div>
        })}
      </div>
      <section className={`activity-runner ${guideComplete ? 'complete' : ''}`}>
        {guidedStep === null && <><span>Lab briefing · {modelById(active.modelId).name}</span><h2>Work checkpoint by checkpoint.</h2><p>{active.description}</p><Button onClick={onStartGuide}>Begin Lab<ArrowRight size={15} /></Button></>}
        {currentStep?.kind === 'action' && <><span>Model action · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.prompt}</h2><div className="lab-action-status"><CircleDot size={15} /><p>Waiting for the exact action and structure in the 3D viewer.</p></div></>}
        {currentStep?.kind === 'question' && <><span>Knowledge check · step {guidedStep! + 1} of {active.steps.length}</span><h2>{currentStep.question}</h2><fieldset>{currentStep.options.map((option, index) => <label key={option}><input type="radio" name={`activity-step-${guidedStep}`} checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset>{quizPassed === undefined ? <Button disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</Button> : <><div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{currentStep.explanation}</p></div>{quizPassed && <Button onClick={onStepContinue}>Continue<ArrowRight size={15} /></Button>}</>}</>}
        {guideComplete && active.modelId === 'digestive-system' && <><span>Sequence complete</span><h2>Pathway check</h2><p>{digestiveDissectionQuiz.question}</p><fieldset>{digestiveDissectionQuiz.options.map((option, index) => <label key={option}><input type="radio" name="activity-quiz" checked={quizChoice === index} onChange={() => onQuizChoice(index)} /><i>{String.fromCharCode(65 + index)}</i>{option}</label>)}</fieldset><button className="primary" disabled={quizChoice === undefined} onClick={onQuizCheck}>Check answer</button>{quizPassed !== undefined && <div className={`activity-feedback ${quizPassed ? 'pass' : 'fail'}`}><strong>{quizPassed ? 'Correct' : 'Not quite'}</strong><p>{digestiveDissectionQuiz.explanation}</p></div>}</>}
        {guideComplete && active.modelId !== 'digestive-system' && <><span>Lab complete</span><h2>Learning sequence completed</h2><p>You identified anatomy, answered the knowledge checks, and completed the model interactions.</p></>}
      </section>
    </section>
  }

  return <section className="content-view dissection-activity-view lab-catalog-view anim">
    <div className="lab-catalog-hero"><div><span>Guided dissection</span><h1>Lab</h1><p>Step-by-step activities that combine structure identification, model manipulation and deterministic knowledge checks. Nerd Bot explains results, it never decides them.</p></div></div>
    <div className="activity-catalog">{anatomyActivities.map((activity) => {
      const model = modelById(activity.modelId)
      return <Card key={activity.id} data-accent={activityAccents[activity.id]}><header><i><FlaskConical size={19} /></i><span>{activity.steps.length} checkpoints</span></header><div><small>{model.name}</small><h2>{activity.title}</h2><p>{activity.description}</p></div><Button onClick={() => onGuided(activity)}>Start Lab<ArrowRight size={14} /></Button></Card>
    })}</div>
  </section>
}
