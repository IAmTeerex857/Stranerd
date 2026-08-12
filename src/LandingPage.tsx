import { ArrowRight, Bot, Check, ChevronRight, EyeOff, Layers3, Library, Move3d, RotateCcw, ScanSearch } from 'lucide-react'
import { LandingHeart, LandingLayeredBody, LandingSpecimen } from './components/LandingHeart'
import { LandingTimeline } from './components/LandingTimeline'
import { Page } from './PublicLayout'
import { useBillingOptions } from './lib/billing'

const subjects = [
  ['heart', 'Heart'], ['brain', 'Brain'], ['lungs', 'Lungs'], ['kidney', 'Kidney'], ['eye', 'Eye'],
  ['liver', 'Liver'], ['nervous-system', 'Nervous system'], ['skin', 'Skin'], ['anatomy', 'Whole body'], ['digestive-system', 'Digestive system'],
] as const

function SectionMarker({ index, children }: { index: string; children: string }) {
  return <div className="landing-marker"><span>{index}</span><p>{children}</p></div>
}

function ExploreInterface() {
  return <div className="landing-product-frame explore-demo" aria-label="Anatomy exploration interface demonstration">
    <header><span>Layered atlas</span><div><i />Whole body</div><small>Systema corporis</small></header>
    <div className="explore-demo-body">
      <div className="explore-structure-map" aria-hidden="true">
        <span className="structure-point point-a"><i />01 <b>Skeleton</b></span>
        <span className="structure-point point-b"><i />02 <b>Cardiovascular</b></span>
        <span className="structure-point point-c"><i />03 <b>Nervous</b></span>
        <LandingLayeredBody />
      </div>
      <aside><span>Visible systems</span><h3>Layered anatomy</h3><p>Compare load-bearing structure, circulation, and neural pathways in the same body reference.</p><dl><div><dt>Layers</dt><dd>3 active</dd></div><div><dt>Reference</dt><dd>Whole body</dd></div></dl></aside>
    </div>
    <footer><span><ScanSearch size={14} /> Select</span><span><Layers3 size={14} /> Layers</span><span><RotateCcw size={14} /> Rotate</span><span>Study context included</span></footer>
  </div>
}

function DissectInterface() {
  return <div className="landing-product-frame dissect-demo" aria-label="Dissect Mode interface demonstration">
    <header><div><span>Dissect Mode</span><strong>Digestive system</strong></div><small>Guided spatial study</small></header>
    <div className="dissect-layout">
      <div className="dissect-stage" aria-hidden="true">
        <LandingSpecimen url="/models/digestive-system-realistic.glb" label="Rotating primary digestive system" className="dissect-real-model" fit={2.75} cameraZ={6.35} rotation={[0, -0.25, 0]} />
        <span className="dissect-label label-stomach">Stomach</span>
        <span className="dissect-label label-pancreas">Pancreas</span>
        <span className="dissect-label label-duodenum">Duodenum</span>
        <div className="movement-axis"><i /><b>Moved outward</b></div>
      </div>
      <aside>
        <div className="dissect-tools"><span><EyeOff size={14} />Hide</span><span><Move3d size={14} />Move</span><span className="active">Isolate</span></div>
        <ol><li className="complete"><Check size={13} />Hide the stomach</li><li className="active"><span>02</span>Isolate the pancreas</li><li><span>03</span>Select the duodenum</li></ol>
        <p>State persists when you leave and return.</p>
      </aside>
    </div>
  </div>
}

function LearningLoop() {
  return <div className="learning-loop-grid">
    <article className="loop-card activity-card"><header><span>01 · Guided activity</span><b>Step 2 of 5</b></header><h3>Trace cardiac flow</h3><p>Relate chambers, vessels, pressure, and direction through model actions.</p><ol><li className="complete"><Check />Select the left ventricle</li><li className="active"><span>02</span>Connect structure to function</li><li><span>03</span>Isolate and compare</li></ol><footer>Action and recall, together</footer></article>
    <article className="loop-card quiz-card-demo"><header><span>02 · Authored quiz</span><b>12 / 20</b></header><h3>Why is the left ventricular wall thicker?</h3><div className="quiz-option correct"><span>A</span><p>Systemic resistance is higher</p></div><div className="quiz-option"><span>B</span><p>Pulmonary blood is more viscous</p></div><footer>Deterministic grading · no AI credit</footer></article>
    <article className="loop-card notebook-card"><header><span>03 · Flashcards</span><Library size={15} /></header><blockquote>“Which anatomical structure is highlighted?”</blockquote><div><span>Verified deck</span><strong>Pancreas</strong></div><footer>Free recall with optional 3D context</footer></article>
  </div>
}

function MentorInterface() {
  return <div className="landing-product-frame mentor-demo">
    <div className="mentor-demo-context"><span>Selected context</span><h3>Left atrium</h3><p>Receives oxygenated blood from the pulmonary veins.</p><div><b>Moved</b><span>Left atrium, pulmonary trunk</span></div><div><b>Hidden</b><span>Right atrium</span></div></div>
    <div className="mentor-demo-chat"><header><Bot size={16} /><span>Stranerd Mentor</span><b>Explicit AI · 1 credit</b></header><div className="mentor-question">Explain the function of every structure I moved.</div><div className="mentor-answer"><span>AI Mentor</span><p><b>Left atrium:</b> receives oxygenated blood returning from both lungs.</p><p><b>Pulmonary trunk:</b> carries deoxygenated blood from the right ventricle toward the pulmonary arteries.</p></div><footer><span>Balance shown before request</span><b>Ask AI · 1 credit <ArrowRight size={14} /></b></footer></div>
  </div>
}

function OrganShowcase() {
  return <article className="organ-showcase eye-world"><div className="organ-visual"><LandingSpecimen url="/models/eye-realistic.glb" label="Rotating realistic eye specimen" fit={3.2} mobileFit={4.25} cameraZ={5.7} rotation={[0, 0.3, 0]} /><strong>Eye</strong></div><div className="organ-facts"><p><span>Eye</span> connects transparent optical structures to neural vision.</p><dl><div><dt>4</dt><dd>study specimens</dd></div><div><dt>20</dt><dd>questions per quiz set</dd></div><div><dt>1</dt><dd>guided optical pathway</dd></div></dl><aside><span>Structures in focus</span><b>Cornea</b><b>Lens</b><b>Retina</b><b>Optic nerve</b></aside><a href="/app?model=eye">Open eye study <ArrowRight /></a></div></article>
}

function LandingPricing() {
  const options = useBillingOptions()
  const nigeria = options?.country === 'NG'
  return <div className="landing-pricing-grid">
    <article><span>Free account</span><h3>{nigeria ? '₦0' : '$0'}</h3><p>Full anatomy learning workspace, with 20 signup credits.</p><ul><li><Check />All anatomy studies</li><li><Check />Guided Labs and free dissection</li><li><Check />Verified assessments and flashcards</li></ul><a href="/app">Start learning <ArrowRight /></a></article>
    <article className="featured"><span>Stranerd Plus</span><h3>{nigeria ? '₦2,500' : '$5'} <small>/ month</small></h3><p>500 AI credits after every successful billing cycle.</p><ul><li><Check />Explicit AI actions</li><li><Check />Credits reset each cycle</li><li><Check />Cancel at period end</li></ul><a href="/pricing">Pay {nigeria ? '₦2,500' : '$5'} <ArrowRight /></a></article>
    <article><span>Credit pack</span><h3>{nigeria ? '₦500' : '$2'}</h3><p>100 purchased credits that do not expire.</p><ul><li><Check />No subscription required</li><li><Check />Buy repeatedly</li><li><Check />Spent after included credits</li></ul><a href="/pricing">Pay {nigeria ? '₦500' : '$2'} <ArrowRight /></a></article>
  </div>
}

const faqs = [
  ['Can I explore anatomy without signing in?', 'Yes. Models, guided Labs, free dissection, verified assessments, default flashcards, and educational context are available without using AI credits.'],
  ['When does Stranerd use a credit?', 'Only when you explicitly ask AI Mentor or request a new AI-generated quiz. The cost is shown before the action.'],
  ['What happens if an AI request fails?', 'The reserved credit is refunded automatically. Failed or invalid AI responses cost zero net credits.'],
  ['Do purchased credits expire?', 'No. Purchased PAYG credits remain in your account and are spent only after free and subscription credits.'],
  ['Is Stranerd medical advice?', 'No. Stranerd is an educational study tool. It does not provide diagnosis, treatment, or patient-specific medical advice.'],
]

export function LandingPage() {
  return <Page><main className="editorial-landing">
    <section className="landing-new-hero" aria-labelledby="landing-title">
      <div className="hero-copy"><span className="landing-kicker">Interactive anatomy for active learners</span><h1 id="landing-title">Do not just look at anatomy.<br /><em>Work with it.</em></h1><p>Explore real spatial relationships, dissect structures, test recall, and ask for AI only when it adds value.</p><div><a className="landing-primary" href="/app">Enter the anatomy lab <ArrowRight /></a><a className="landing-secondary" href="#how-it-works">See how it works</a></div></div>
      <div className="hero-model-wrap"><LandingHeart /><span className="hero-model-label label-top">01 · Ascending aorta</span><span className="hero-model-label label-bottom">02 · Left ventricle</span><small>Drag to inspect</small></div>
      <footer><span>10 anatomy studies</span><span>Persistent dissection</span><span>Authored learning loop</span><span>Optional AI Mentor</span></footer>
    </section>

    <section className="landing-preface landing-reveal" id="how-it-works"><SectionMarker index="01">The problem</SectionMarker><p>Flat diagrams are good for naming structures. They are less useful for understanding what sits behind, beneath, around, and through them.</p></section>

    <LandingTimeline />

    <section className="landing-thesis"><div className="thesis-sticky"><span>Stranerd’s thesis</span><div className="thesis-lines"><p>Anatomy is more than <strong className="accent-green"><i />names.</strong></p><p>It is shaped by <strong className="accent-blue"><i />space</strong> and relationships.</p><p>With deliberate <strong className="accent-purple"><i />action</strong>, learners turn observation into recall.</p><p>Optional <strong className="accent-pink"><i />AI</strong> explains the full context they created.</p></div><LandingSpecimen url="/models/brain-realistic.glb" label="Rotating brain behind the Stranerd learning thesis" className="thesis-brain-model" fit={3.1} cameraZ={5.6} /><div className="thesis-dot-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div></section>

    <section className="landing-story landing-reveal"><SectionMarker index="02">Explore</SectionMarker><div className="story-heading"><h2>Start with the structure.<br />Keep the context.</h2><p>Select exact anatomy, rotate the specimen, compare layers, and review concise study context without spending a credit.</p></div><ExploreInterface /></section>

    <section className="landing-story landing-reveal"><SectionMarker index="03">Dissect</SectionMarker><div className="story-heading split"><h2>Pull relationships apart.<br />Then put the idea together.</h2><p>Hide, fade, isolate, and move structures. Guided activities connect each action to a spatial or functional question.</p></div><DissectInterface /></section>

    <section className="landing-loop landing-reveal"><SectionMarker index="04">Learn actively</SectionMarker><div className="story-heading"><h2>A learning loop, not a model viewer.</h2><p>Every session can move from observation to action, recall, explanation, and measured progress.</p></div><LearningLoop /></section>

    <section className="landing-organ-worlds landing-reveal"><SectionMarker index="05">Across systems</SectionMarker><div className="story-heading"><h2>Different anatomy.<br />One learning language.</h2><p>Color and motion change with the subject. The controls and study loop stay familiar.</p></div><OrganShowcase /></section>

    <section className="landing-ai landing-reveal"><SectionMarker index="06">AI, when requested</SectionMarker><div className="story-heading split"><h2>Context-aware help.<br />Never an invisible charge.</h2><p>Mentor receives your selected and moved structures. You choose when to ask, see the cost first, and pay nothing when a request fails.</p></div><MentorInterface /></section>

    <section className="landing-library landing-reveal"><SectionMarker index="07">The anatomy library</SectionMarker><div className="library-heading"><h2>Study one organ deeply.<br />Or connect the whole body.</h2><p>Each subject includes realistic and interactive specimens where the source geometry supports them.</p></div><div className="subject-index">{subjects.map(([id, subject], index) => <a key={id} href={`/app?model=${id}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{subject}</strong><ChevronRight /></a>)}</div></section>

    <section className="landing-pricing landing-reveal" id="landing-pricing"><SectionMarker index="08">Simple pricing</SectionMarker><div className="story-heading"><h2>Core learning stays open.<br />AI stays transparent.</h2><p>Use the anatomy workspace freely. Add AI credits through a monthly plan or a non-expiring pack.</p></div><LandingPricing /></section>

    <section className="landing-faq landing-reveal"><SectionMarker index="09">Questions</SectionMarker><div><h2>Before you begin.</h2><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>

    <section className="landing-final"><span>Ready when you are</span><h2>Open the body.<br />Build the understanding.</h2><a href="/app"><span>Start learning</span><ArrowRight /></a></section>
  </main></Page>
}
