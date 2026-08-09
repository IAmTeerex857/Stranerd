import { useEffect, useRef, useState, type CSSProperties } from 'react'

const stages = [
  {
    eyebrow: 'Name the parts',
    title: 'See anatomy',
    copy: 'Textbooks and diagrams establish the vocabulary. The learner identifies structures and learns standard anatomical language.',
    events: ['Labels', 'Regions', 'Systems'],
  },
  {
    eyebrow: 'Build spatial context',
    title: 'Explore anatomy',
    copy: 'Three-dimensional specimens make depth, orientation, and neighboring structures available for direct inspection.',
    events: ['Rotate', 'Select', 'Compare'],
  },
  {
    eyebrow: 'Act on relationships',
    title: 'Dissect anatomy',
    copy: 'Hiding, fading, isolating, and moving structures turns spatial relationships into deliberate learner actions.',
    events: ['Hide', 'Move', 'Isolate'],
  },
  {
    eyebrow: 'Turn action into recall',
    title: 'Understand anatomy',
    copy: 'Guided Labs, verified assessments, progress, and optional AI connect what changed on the model to what the learner can explain.',
    events: ['Recall', 'Explain', 'Persist'],
  },
] as const

export function LandingTimeline() {
  const section = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const element = section.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      const distance = Math.max(1, element.offsetHeight - window.innerHeight)
      setProgress(Math.min(1, Math.max(0, -bounds.top / distance)))
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const activeIndex = Math.min(stages.length - 1, Math.floor(progress * stages.length))
  const active = stages[activeIndex]
  const localProgress = progress * stages.length - activeIndex

  return <section ref={section} className="landing-timeline" aria-label="From anatomy diagrams to active learning">
    <div className={`timeline-sticky stage-${activeIndex}`}>
      <div className="timeline-copy">
        <div><span>{active.eyebrow}</span><h2>{active.title}</h2><p>{active.copy}</p></div>
        <aside><span>Learning actions</span>{active.events.map((event, index) => <div key={event} className={index <= Math.round(localProgress * 2) ? 'active' : ''}><i />{event}</div>)}</aside>
      </div>
      <div className="timeline-motion" style={{ '--timeline-progress': localProgress } as CSSProperties} aria-hidden="true">
        <svg viewBox="0 0 1000 250" preserveAspectRatio="xMidYMid meet">
          <path className="motion-path path-a" d="M70 174 C220 20 370 220 505 82 S760 50 930 164" />
          <path className="motion-path path-b" d="M70 86 C250 230 390 30 552 170 S790 220 930 70" />
          {Array.from({ length: 32 }, (_, index) => {
            const x = 72 + index * 27.7
            const y = 125 + Math.sin(index * 0.78 + activeIndex * 1.25) * (42 + activeIndex * 5)
            return <circle key={index} className={`motion-node node-${index % 4}`} cx={x} cy={y} r={3 + (index % 3)} style={{ '--node-delay': `${index * 17}ms` } as CSSProperties} />
          })}
          <g className="motion-core" style={{ transform: `translate(${70 + progress * 860}px, 125px)` }}>
            <circle r="54" className="core-ring ring-a" />
            <circle r="34" className="core-ring ring-b" />
            <circle r="12" className="core-dot" />
          </g>
        </svg>
        <span>{activeIndex === 0 ? 'Vocabulary map' : activeIndex === 1 ? 'Spatial network' : activeIndex === 2 ? 'Action trace' : 'Learning state'}</span>
      </div>
      <div className="timeline-labels">{stages.map((stage, index) => <span key={stage.title} className={index === activeIndex ? 'active' : ''}><b>{String(index + 1).padStart(2, '0')}</b>{stage.title}</span>)}</div>
      <div className="timeline-track" aria-hidden="true">
        {stages.map((stage, index) => <i key={stage.title} className={`track-${index}`} />)}
        <b style={{ left: `calc(${progress * 100}% - 1px)` }} />
      </div>
      <strong>{String(Math.round(progress * 100)).padStart(2, '0')}%</strong>
    </div>
  </section>
}
