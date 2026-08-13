import { ArrowRight, Bot, Check, ChevronRight, EyeOff, Layers3, Library, Move3d, RotateCcw, ScanSearch } from 'lucide-react'
import { LandingHeart, LandingLayeredBody, LandingSpecimen } from './components/LandingHeart'
import { LandingTimeline } from './components/LandingTimeline'
import { Page } from './PublicLayout'

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
    <div className="mentor-demo-chat"><header><Bot size={16} /><span>Nerd Bot</span><b>Explicit AI · 1 credit</b></header><div className="mentor-question">Explain the function of every structure I moved.</div><div className="mentor-answer"><span>Nerd Bot</span><p><b>Left atrium:</b> receives oxygenated blood returning from both lungs.</p><p><b>Pulmonary trunk:</b> carries deoxygenated blood from the right ventricle toward the pulmonary arteries.</p></div><footer><span>Balance shown before request</span><b>Ask Nerd Bot · 1 credit <ArrowRight size={14} /></b></footer></div>
  </div>
}

function OrganShowcase() {
  return <article className="organ-showcase eye-world"><div className="organ-visual"><LandingSpecimen url="/models/eye-realistic.glb" label="Rotating realistic eye specimen" fit={3.2} mobileFit={4.25} cameraZ={5.7} rotation={[0, 0.3, 0]} /><strong>Eye</strong></div><div className="organ-facts"><p><span>Eye</span> connects transparent optical structures to neural vision.</p><dl><div><dt>4</dt><dd>study specimens</dd></div><div><dt>20</dt><dd>questions per quiz set</dd></div><div><dt>1</dt><dd>guided optical pathway</dd></div></dl><aside><span>Structures in focus</span><b>Cornea</b><b>Lens</b><b>Retina</b><b>Optic nerve</b></aside><a href="/app?model=eye">Open eye study <ArrowRight /></a></div></article>
}

function StranerdOffers() {
  const cards = [
    ['Subject notes', '22', 'Notes across 22 medical subjects', 'notes'],
    ['Learning sections', '6,700+', 'structured learning sections', 'sections'],
    ['Assessments', '22', 'twenty-question subject assessments', 'assessments'],
    ['Practice', '440', 'practice questions', 'practice'],
    ['Mnemonics', '1,800+', 'medical mnemonics', 'mnemonics'],
    ['Diagrams & figures', '1,400+', 'medical diagrams and figures', 'diagrams'],
    ['Virtual labs', '10', 'guided virtual dissection labs', 'labs'],
  ] as const
  return <section className="landing-offers" aria-labelledby="landing-offers-title">
    <header className="offers-heading"><div><span>What Stranerd offers</span><h2 id="landing-offers-title">One workspace.<br />Every way you learn anatomy.</h2><p>A source-grounded library, interactive 3D models, and virtual dissection labs, tied together by progress and search that follow you everywhere.</p></div><aside><span>22 medical subjects</span><span>Source-grounded learning</span><span>Synced &amp; searchable</span></aside></header>
    <div className="offers-grid">
      <article className="offer-card offer-models"><header><span>Interactive 3D</span><b>Flagship</b></header><div><strong>10</strong><h3>interactive 3D<br />anatomy models</h3></div><p>Structure selection, isolation, transparency, movement and exploration, layered over a whole-body anatomy atlas.</p></article>
      <article className="offer-card offer-flashcards"><span>Flashcards</span><div><strong>16,000+</strong><p>source-grounded<br />flashcards</p></div></article>
      {cards.map(([label, count, copy, kind]) => <article className={`offer-card offer-stat offer-${kind}`} key={kind}><span>{label}</span><div><strong>{count}</strong><p>{copy}</p></div></article>)}
      <article className="offer-card offer-ai"><span>AI mentor</span><div><strong>Help when you ask</strong><p>Context-aware guidance, never in the way.</p></div></article>
    </div>
  </section>
}

const faqs = [
  ['Can I explore anatomy without signing in?', 'Yes. Models, guided Labs, free dissection, verified assessments, default flashcards, and educational context are available without using AI credits.'],
  ['When does Stranerd use a credit?', 'Only when you explicitly ask Nerd Bot or request a new AI-generated quiz. The cost is shown before the action.'],
  ['What happens if an AI request fails?', 'The reserved credit is refunded automatically. Failed or invalid AI responses cost zero net credits.'],
  ['Do purchased credits expire?', 'No. Purchased PAYG credits remain in your account and are spent only after free and subscription credits.'],
  ['Is Stranerd medical advice?', 'No. Stranerd is an educational study tool. It does not provide diagnosis, treatment, or patient-specific medical advice.'],
]

export function LandingPage() {
  return <Page><main className="editorial-landing">
    <section className="landing-new-hero" aria-labelledby="landing-title">
      <div className="hero-copy"><span className="landing-kicker">Interactive anatomy for active learners</span><h1 id="landing-title">Do not just look at anatomy.<br /><em>Work with it.</em></h1><p>Explore real spatial relationships, dissect structures, test recall, and ask for AI only when it adds value.</p><div><a className="landing-primary" href="/app">Enter the anatomy lab <ArrowRight /></a><a className="landing-secondary" href="#how-it-works">See how it works</a></div></div>
      <div className="hero-model-wrap"><LandingHeart /><span className="hero-model-label label-top">01 · Ascending aorta</span><span className="hero-model-label label-bottom">02 · Left ventricle</span><small>Drag to inspect</small></div>
      <footer><span>10 anatomy studies</span><span>Persistent dissection</span><span>Authored learning loop</span><span>Optional Nerd Bot</span></footer>
    </section>

    <StranerdOffers />

    <section className="landing-preface landing-reveal" id="how-it-works"><SectionMarker index="01">The problem</SectionMarker><p>Flat diagrams are good for naming structures. They are less useful for understanding what sits behind, beneath, around, and through them.</p></section>

    <LandingTimeline />

    <section className="landing-thesis"><div className="thesis-sticky"><span>Stranerd’s thesis</span><div className="thesis-lines"><p>Anatomy is more than <strong className="accent-green"><i />names.</strong></p><p>It is shaped by <strong className="accent-blue"><i />space</strong> and relationships.</p><p>With deliberate <strong className="accent-purple"><i />action</strong>, learners turn observation into recall.</p><p>Optional <strong className="accent-pink"><i />AI</strong> explains the full context they created.</p></div><LandingSpecimen url="/models/brain-realistic.glb" label="Rotating brain behind the Stranerd learning thesis" className="thesis-brain-model" fit={3.1} cameraZ={5.6} /><div className="thesis-dot-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div></section>

    <section className="landing-story landing-reveal"><SectionMarker index="02">Explore</SectionMarker><div className="story-heading"><h2>Start with the structure.<br />Keep the context.</h2><p>Select exact anatomy, rotate the specimen, compare layers, and review concise study context without spending a credit.</p></div><ExploreInterface /></section>

    <section className="landing-story landing-reveal"><SectionMarker index="03">Dissect</SectionMarker><div className="story-heading split"><h2>Pull relationships apart.<br />Then put the idea together.</h2><p>Hide, fade, isolate, and move structures. Guided activities connect each action to a spatial or functional question.</p></div><DissectInterface /></section>

    <section className="landing-loop landing-reveal"><SectionMarker index="04">Learn actively</SectionMarker><div className="story-heading"><h2>A learning loop, not a model viewer.</h2><p>Every session can move from observation to action, recall, explanation, and measured progress.</p></div><LearningLoop /></section>

    <section className="landing-organ-worlds landing-reveal"><SectionMarker index="05">Across systems</SectionMarker><div className="story-heading"><h2>Different anatomy.<br />One learning language.</h2><p>Color and motion change with the subject. The controls and study loop stay familiar.</p></div><OrganShowcase /></section>

    <section className="landing-ai landing-reveal"><SectionMarker index="06">AI, when requested</SectionMarker><div className="story-heading split"><h2>Context-aware help.<br />Never an invisible charge.</h2><p>Nerd Bot receives your selected and moved structures. You choose when to ask, see the cost first, and pay nothing when a request fails.</p></div><MentorInterface /></section>

    <section className="landing-library landing-reveal"><SectionMarker index="07">The anatomy library</SectionMarker><div className="library-heading"><h2>Study one organ deeply.<br />Or connect the whole body.</h2><p>Each subject includes realistic and interactive specimens where the source geometry supports them.</p></div><div className="subject-index">{subjects.map(([id, subject], index) => <a key={id} href={`/app?model=${id}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{subject}</strong><ChevronRight /></a>)}</div></section>

    <section className="landing-faq landing-reveal"><SectionMarker index="08">Questions</SectionMarker><div><h2>Before you begin.</h2><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>

    <section className="landing-final"><span>Ready when you are</span><h2>Open the body.<br />Build the understanding.</h2><a href="/app"><span>Start learning</span><ArrowRight /></a></section>
  </main></Page>
}
