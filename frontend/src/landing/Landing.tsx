// The front page (spec: LANDING.md). An opening film from space down to Sarawak, then
// Problem / Opportunity / Solution, how it works, tech stack, impact and a call to action.
// Animated with anime.js; skipped entirely under prefers-reduced-motion.
// Images are saved NASA GIBS files; nothing is fetched from NASA when the page loads.
// AI-assisted: written with Claude Code.
import { animate, createTimeline, stagger } from 'animejs'
import { useEffect, useRef, useState } from 'react'
import './landing.css'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Stars() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    let raf = 0, w = 0, h = 0
    const stars = Array.from({ length: 220 }, (_, i) => ({ x: (i * 7919) % 1000 / 1000, y: (i * 104729) % 1000 / 1000, r: 0.4 + ((i * 31) % 10) / 9, s: 0.2 + ((i * 17) % 10) / 12 }))
    const size = () => { w = c.width = c.offsetWidth * devicePixelRatio; h = c.height = c.offsetHeight * devicePixelRatio }
    size(); window.addEventListener('resize', size)
    const draw = (t: number) => {
      g.clearRect(0, 0, w, h)
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t / 900 * s.s + s.x * 40)
        g.globalAlpha = tw
        g.fillStyle = s.r > 1.2 ? '#ffe9c4' : '#ffffff'
        g.beginPath(); g.arc(((s.x + t / 240000 * s.s) % 1) * w, s.y * h, s.r * devicePixelRatio, 0, 6.3); g.fill()
      }
      if (!reduced()) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="stars" aria-hidden="true" />
}

const STEPS = [
  ['1', 'The Call', 'A client brings a real event', 'select'],
  ['2', 'The Scene', 'Fly over Sarawak in 3D', 'select'],
  ['3', 'Evidence Locker', 'Choose the records, reject the red herring', 'select'],
  ['4', 'The Board', 'See each record over the years', 'time'],
  ['5', 'The Lab', 'Remove seasons, measure, test', 'much'],
  ['6', 'The Deduction', 'Write your own verdict', 'sig'],
  ['7', 'Case Closed', "The Chief's stamp and report", 'sig'],
] as const
const ASKS = [
  ['select', 'Select variables'], ['time', 'See change over time'], ['much', 'What, where, how much'], ['sig', 'Is it significant?'],
] as const

const STACK: [string, string[]][] = [
  ['Earth data', ['NASA POWER (MERRA-2)', 'NASA GIBS: VIIRS fire detections', 'NASA GIBS: Blue Marble', 'NOAA RONI (El Niño)', 'SRTM-derived terrain']],
  ['Statistics in code', ['Python', 'statsmodels', 'pymannkendall', 'pandas', 'xarray']],
  ['AI with guard rails', ['Gemini on Vertex AI', 'Google ADK', 'Number guard', 'Answer guard']],
  ['App', ['React', 'TypeScript', 'three.js', 'Apache ECharts', 'anime.js', 'FastAPI', 'Cloud Run', 'Firebase Hosting', 'Cloud Firestore']],
]

const IMPACT: [string, string, string][] = [
  ['Students', 'Hear about disasters from social media, or ask a chatbot for an answer', 'Investigate the event with real NASA data, and learn what "significant" means by using it'],
  ['Teachers', 'Global, generic climate examples and data tools that feel intimidating', 'Ready-made local cases with a report per student'],
  ['Schools and clubs', 'No Sarawak-specific Earth-data activity', 'A case library that grows with each new event'],
  ['The public', 'Claims about "worsening" weather with no way to check', "A plain record of what the data does and doesn't show"],
]
const FIGURES: [number, string, string, number][] = [
  [710, '', 'Sarawak schools closed by haze in 2026', 0],
  [238303, '', 'students affected by those closures', 0],
  [83.2, '%', 'of young Malaysians surveyed lived through a climate-related disaster in the past year', 1],
]

export function Landing({ onEnter }: { onEnter: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [filmDone, setFilmDone] = useState(reduced)
  const tl = useRef<ReturnType<typeof createTimeline> | null>(null)

  // opening film
  useEffect(() => {
    if (reduced()) return
    const t = createTimeline({ defaults: { ease: 'outCubic' }, onComplete: () => setFilmDone(true) })
    t.add('.film-line.l1', { opacity: [0, 1], translateY: [16, 0], duration: 700 }, 200)
      .add('.sat', { translateX: ['-20vw', '120vw'], translateY: ['10vh', '-14vh'], rotate: [-12, -12], duration: 5200, ease: 'linear' }, 0)
      .add('.film-line.l1', { opacity: 0, duration: 400 }, 1500)
      .add('.earth', { translateY: ['70vh', '0vh'], scale: [0.7, 1], opacity: [0, 1], duration: 1600, ease: 'outQuart' }, 1300)
      .add('.earth-map', { backgroundPositionX: ['40%', '112.8%'], duration: 2200, ease: 'inOutSine' }, 1300)
      .add('.film-line.l2', { opacity: [0, 1], translateY: [16, 0], duration: 600 }, 1900)
      .add('.film-line.l2', { opacity: 0, duration: 400 }, 3300)
      .add('.earth', { scale: 14, opacity: [1, 0], duration: 1500, ease: 'inQuart' }, 3500)
      .add('.sarawak', { opacity: [0, 1], scale: [1.5, 1.06], duration: 1900, ease: 'outQuart' }, 4300)
      .add('.hero-veil', { opacity: [0, 1], duration: 1200 }, 4800)
      .add('.fires', { opacity: [0, 1], duration: 500 }, 5000)
      .add('.film-line.l3', { opacity: [0, 1], letterSpacing: ['0.6em', '0.18em'], duration: 900 }, 4900)
      .add('.hero-copy > *', { opacity: [0, 1], translateY: [24, 0], duration: 700, delay: stagger(140) }, 5700)
    tl.current = t
    return () => { t.pause() }
  }, [])

  function skip() { tl.current?.seek(tl.current.duration); setFilmDone(true) }

  // sections animate in as they scroll into view; figures count up
  useEffect(() => {
    const el = root.current!
    if (reduced()) { el.querySelectorAll('.reveal').forEach((n) => n.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        const kids = e.target.querySelectorAll<HTMLElement>('.pop')
        e.target.classList.add('in')
        animate(kids, { opacity: [0, 1], translateY: [28, 0], scale: [0.96, 1], duration: 650, delay: stagger(90), ease: 'outBack' })
        e.target.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
          const to = Number(n.dataset.count), dp = Number(n.dataset.dp ?? 0), o = { v: 0 }
          animate(o, { v: to, duration: 1600, ease: 'outExpo', onUpdate: () => { n.textContent = o.v.toLocaleString('en', { minimumFractionDigits: dp, maximumFractionDigits: dp }) } })
        })
      }
    }, { threshold: 0.18 })
    el.querySelectorAll('.reveal').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  return (
    <div className="landing" ref={root}>
      <section className={`hero ${filmDone ? 'done' : ''}`} aria-label="Sarawak Earth Detectives">
        <Stars />
        <div className="sat" aria-hidden="true"><i /><b /><i /></div>
        <div className="earth" aria-hidden="true"><div className="earth-map" /><div className="earth-shade" /></div>
        <div className="sarawak" aria-hidden="true">
          <img src="/scenes/001/base.jpg" alt="" />
          <img className="fires" src="/scenes/001/fires_2026-04-02.png" alt="" />
        </div>
        <div className="hero-veil" aria-hidden="true" />
        <p className="film-line l1" aria-hidden="true">Every day, satellites watch the Earth.</p>
        <p className="film-line l2" aria-hidden="true">For forty-five years they have kept the record.</p>
        <p className="film-line l3">Sarawak, Borneo · 2.5° N, 113° E</p>
        <div className="hero-copy">
          <p className="kicker">NASA Space Apps 2026 · Be an Earth System Trend Detective</p>
          <h1>Sarawak Earth Detectives</h1>
          <p className="tag">Real events. Real NASA data. <strong>You're the detective.</strong></p>
          <p className="sub">A detective agency for students. A client brings you real cases about Sarawak's fires, haze and floods, and you solve them with decades of satellite data.</p>
          <div className="cta-row">
            <button className="cta" onClick={onEnter}>Enter the office</button>
            <a className="ghost" href="#how">How it works</a>
          </div>
        </div>
        {!filmDone && <button className="skip" onClick={skip}>Skip intro</button>}
        <p className="credit">Imagery: NASA GIBS (Blue Marble; VIIRS fire detections, 2 Apr 2026)</p>
      </section>

      <section className="band reveal" id="pos">
        <h2>The case for this project</h2>
        <div className="pos">
          <article className="pop p"><span>Problem</span>
            <h3>They live it, but can't check it</h3>
            <p>Students in Sarawak live through floods, haze and peat fires, yet mostly learn about them from social media. In 2026, haze closed 710 Sarawak schools with 238,303 students. A chatbot gives an answer, not understanding.</p></article>
          <article className="pop o"><span>Opportunity</span>
            <h3>Decades of free Earth data</h3>
            <p>NASA keeps open records of rain, heat, soil and fire going back decades. The challenge asks for a tool where a user selects variables, sees change over time, and decides what is changing, where, how much, and whether it is significant.</p></article>
          <article className="pop s"><span>Solution</span>
            <h3>A detective agency</h3>
            <p>Every real event becomes a case with one question: <em>is this getting worse, or was it one bad year?</em> The student does the science. The AI only gives hints. Code does every number. "Not enough evidence" can be the winning verdict.</p></article>
        </div>
      </section>

      <section className="band dark reveal" id="how">
        <h2>How it works</h2>
        <p className="lead">Seven steps in a 3D detective office. Together they are exactly the four things the challenge asks.</p>
        <div className="asks">
          {ASKS.map(([k, name]) => (
            <div key={k} className={`ask pop k-${k}`}>
              <h3>{name}</h3>
              <ol>{STEPS.filter((s) => s[3] === k).map(([n, title, what]) => (
                <li key={n}><b>{n}</b><div><strong>{title}</strong><small>{what}</small></div></li>
              ))}</ol>
            </div>
          ))}
        </div>
        <div className="bird-line pop">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
            <circle cx="26" cy="36" r="17" fill="#141414" stroke="#f6c700" strokeWidth="2" /><path d="M36 30 Q58 30 62 44 Q48 42 38 42 Z" fill="#f1e3b5" />
            <path d="M30 22 Q46 8 56 18 Q46 20 40 30 Z" fill="#e2571e" /><circle cx="29" cy="32" r="4.5" fill="#fff" /><circle cx="30" cy="32" r="2.2" fill="#c8102e" />
          </svg>
          <p><strong>Kenyalang, your hornbill partner:</strong> "I'll guide you through every step and explain any word. I give hints. I never give the answer."</p>
        </div>
      </section>

      <section className="band reveal" id="stack">
        <h2>Tech stack</h2>
        <div className="stack">
          {STACK.map(([group, items]) => (
            <div key={group} className="stack-group">
              <h3>{group}</h3>
              <ul>{items.map((i) => <li key={i} className="pop">{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="note">The AI never does the maths. Every number a student sees comes from statistics code and shows its NASA source and the date of its newest data.</p>
      </section>

      <section className="band dark reveal" id="impact">
        <h2>Impact</h2>
        <div className="figures">
          {FIGURES.map(([n, unit, what, dp]) => (
            <div key={what} className="fig pop"><p><span data-count={n} data-dp={dp}>{n.toLocaleString('en')}</span>{unit}</p><small>{what}</small></div>
          ))}
        </div>
        <div className="ba">
          {IMPACT.map(([who, before, after]) => (
            <div key={who} className="ba-row pop"><h3>{who}</h3><p className="before"><span>Before</span>{before}</p><p className="after"><span>After</span>{after}</p></div>
          ))}
        </div>
        <p className="sdg">Supports SDG 4.7 · 13.3 · 11.5 · 16.10</p>
        <p className="note honest"><strong>Honest limits.</strong> No teacher or student has tested this yet, and curriculum alignment has not been checked. This is a working prototype built in one weekend.</p>
      </section>

      <section className="final reveal">
        <img src="/scenes/001/base.jpg" alt="" aria-hidden="true" />
        <div className="pop">
          <h2>A case is waiting on your desk.</h2>
          <p>No login. No download. Bring your curiosity.</p>
          <button className="cta" onClick={onEnter}>Enter the office</button>
        </div>
      </section>

      <footer className="foot-land">
        <p><strong>Data:</strong> NASA POWER (MERRA-2), NASA GIBS (VIIRS on Suomi NPP, Blue Marble), NOAA Relative Oceanic Niño Index, SRTM-derived terrain tiles.</p>
        <p><strong>Sources for the figures:</strong> Malay Mail, 6 Sep 2026 (haze school closures); UNICEF Malaysia, 28 Jul 2026 (youth climate survey).</p>
        <p><strong>AI disclosure:</strong> built with AI assistance (Claude Code). In the app, Gemini writes hints and feedback; every number comes from statistics code.</p>
        <p>Built for NASA Space Apps 2026. Not endorsed by NASA.</p>
      </footer>
    </div>
  )
}
