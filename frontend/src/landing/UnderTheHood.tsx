// "Under the hood": three animated diagrams for the landing page.
// 1. System architecture   2. The two AI agents and their guard rails   3. The statistics engine.
// Pure SVG: lines draw themselves when the section scrolls into view (CSS on `.reveal.in`), and
// small packets travel along the wires (SMIL animateMotion). Everything shown is what is built;
// nothing planned is drawn as if it exists.
// AI-assisted: written with Claude Code.
import type { ReactNode } from 'react'

const reduce = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Node({ x, y, w, h, title, lines = [], tone = 'paper', i = 0 }: {
  x: number; y: number; w: number; h: number; title: string; lines?: string[]; tone?: 'paper' | 'ink' | 'gold' | 'red' | 'teal' | 'lock'; i?: number
}) {
  return (
    <g className={`node n-${tone}`} style={{ '--i': i } as React.CSSProperties}>
      <rect x={x} y={y} width={w} height={h} rx={12} />
      <text x={x + w / 2} y={y + (lines.length ? 26 : h / 2 + 5)} textAnchor="middle" className="n-title">{title}</text>
      {lines.map((l, k) => <text key={k} x={x + w / 2} y={y + 46 + k * 17} textAnchor="middle" className="n-line">{l}</text>)}
    </g>
  )
}

/** A wire that draws itself, with an optional packet travelling along it. */
function Wire({ d, id, i = 0, packet = true, dur = 2.6, dashed = false, label, lx, ly }: {
  d: string; id: string; i?: number; packet?: boolean; dur?: number; dashed?: boolean; label?: string; lx?: number; ly?: number
}) {
  return (
    <g className="wire" style={{ '--i': i } as React.CSSProperties}>
      <path id={id} d={d} pathLength={1} className={dashed ? 'draw dashed' : 'draw'} markerEnd="url(#arrow)" />
      {packet && !reduce() && (
        <circle r={5} className="packet"><animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${1.2 + i * 0.25}s`}><mpath href={`#${id}`} /></animateMotion></circle>
      )}
      {label && <text x={lx} y={ly} textAnchor="middle" className="w-label">{label}</text>}
    </g>
  )
}

function Diagram({ viewBox, label, children }: { viewBox: string; label: string; children: ReactNode }) {
  return (
    <div className="diagram pop">
      <svg viewBox={viewBox} role="img" aria-label={label}>
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="arrowhead" /></marker></defs>
        {children}
      </svg>
    </div>
  )
}

function Architecture() {
  return (
    <section className="band reveal" id="architecture">
      <p className="eyebrow">Under the hood · 1 of 3</p>
      <h2>System architecture</h2>
      <p className="lead">One web page, one small API, and files of NASA data saved ahead of time. Nothing is fetched from NASA while a student is working, so a lesson never waits on someone else's server.</p>
      <Diagram viewBox="0 0 1000 470" label="System architecture: the browser talks to one API on Cloud Run, which uses statistics code, two AI agents, Firestore and a data vault built from NASA data.">
        <Node i={0} x={30} y={150} w={210} h={120} title="Student's browser" lines={['React + three.js office', '2D lite mode · ECharts', 'no login, nickname only']} />
        <Node i={1} x={52} y={40} w={166} h={56} title="Firebase Hosting" lines={['serves the page']} tone="ink" />
        <Node i={2} x={385} y={130} w={220} h={160} title="API on Cloud Run" lines={['Python · FastAPI', 'holds the session', 'grades the verdict in code', 'never serves the answer key']} tone="gold" />
        <Node i={3} x={750} y={30} w={220} h={100} title="Statistics code" lines={['statsmodels · pymannkendall', 'every number comes from here']} tone="teal" />
        <Node i={4} x={750} y={160} w={220} h={100} title="AI agents (Google ADK)" lines={['Gemini on Vertex AI', 'Partner hints · Chief wording']} tone="red" />
        <Node i={5} x={750} y={290} w={220} h={84} title="Cloud Firestore" lines={['sessions: nickname + steps']} tone="ink" />
        <Node i={6} x={385} y={360} w={220} h={84} title="Data vault" lines={['monthly records, maps, answer keys']} />
        <Node i={7} x={30} y={350} w={250} h={100} title="NASA and NOAA open data" lines={['POWER (MERRA-2) · GIBS (VIIRS)', 'Blue Marble · RONI · SRTM terrain']} tone="ink" />
        <Wire i={1} id="a1" d="M135 96 L135 150" packet={false} />
        <Wire i={2} id="a2" d="M240 195 L385 195" label="choose · test · ask" lx={312} ly={183} />
        <Wire i={3} id="a3" d="M385 235 L240 235" label="charts · hints" lx={312} ly={255} dur={3} />
        <Wire i={4} id="a4" d="M605 170 C680 170 680 80 750 80" />
        <Wire i={5} id="a5" d="M605 210 L750 210" dur={3.1} />
        <Wire i={6} id="a6" d="M605 250 C680 250 680 332 750 332" dur={2.9} />
        <Wire i={7} id="a7" d="M495 360 L495 290" dur={2.2} />
        <Wire i={8} id="a8" d="M280 402 L385 402" dashed label="saved before, never during a lesson" lx={332} ly={465} dur={3.4} />
      </Diagram>
    </section>
  )
}

function Agents() {
  return (
    <section className="band dark reveal" id="agents">
      <p className="eyebrow">Under the hood · 2 of 3</p>
      <h2>Four AI agents on a short leash</h2>
      <p className="lead">The AI may find a story, explain and encourage. It may not calculate, it may not give the answer, and it may not publish. Plain code stands on both sides of it, and a person approves every new case.</p>
      <Diagram viewBox="0 0 1000 700" label="Agent pipelines. Partner: code builds the prompt without the answer key, Gemini replies, a number guard and an answer guard check the reply, and an approved hint is used if a check fails. Chief: code grades, Gemini words the grade. Case desk: news and NASA records pass a code checklist, Gemini screens and writes the brief, the guards check it, code computes the answer key, and a human editor approves.">
        <text x={30} y={34} className="row-title">Kenyalang, the Partner: hints, never answers</text>
        <Node i={0} x={30} y={60} w={150} h={96} title="Student asks" lines={['"Is it getting', 'drier?"']} />
        <Node i={1} x={220} y={60} w={180} h={96} title="Code builds the prompt" lines={['the case, their steps,', 'hints unlocked so far']} tone="gold" />
        <Node i={2} x={440} y={60} w={150} h={96} title="Gemini" lines={['ADK LlmAgent', '12 s time limit']} tone="red" />
        <Node i={3} x={630} y={60} w={150} h={96} title="Number guard" lines={['any number the code', "didn't supply? Block."]} tone="teal" />
        <Node i={4} x={820} y={60} w={150} h={96} title="Answer guard" lines={['says rising, falling,', 'significant? Block.']} tone="teal" />
        <Node i={5} x={820} y={196} w={150} h={62} title="Reply to student" tone="paper" />
        <Node i={6} x={440} y={196} w={340} h={62} title="Blocked or slow → an approved hint" tone="ink" />
        <Node i={7} x={220} y={196} w={180} h={62} title="🔒 Answer key" tone="lock" />
        <Wire i={1} id="g1" d="M180 108 L220 108" /><Wire i={2} id="g2" d="M400 108 L440 108" /><Wire i={3} id="g3" d="M590 108 L630 108" />
        <Wire i={4} id="g4" d="M780 108 L820 108" /><Wire i={5} id="g5" d="M895 156 L895 196" />
        <Wire i={5} id="g6" d="M705 156 L705 196" dashed packet={false} /><Wire i={6} id="g7" d="M780 227 L820 227" dashed packet={false} />
        <path className="wall" d="M310 162 L310 190" />
        <text x={310} y={282} textAnchor="middle" className="w-label">never sent to the AI or the browser</text>

        <text x={30} y={330} className="row-title">The Chief: words the grade that code has already decided</text>
        <Node i={8} x={30} y={356} w={170} h={96} title="Student's verdict" lines={['in their own words']} />
        <Node i={9} x={240} y={356} w={190} h={96} title="Code grades it" lines={['rubric + answer key', 'score in 0.2 s']} tone="gold" />
        <Node i={10} x={470} y={356} w={150} h={96} title="Gemini" lines={['gets the grade,', 'not the key']} tone="red" />
        <Node i={11} x={660} y={356} w={130} h={96} title="Both guards" lines={['same checks']} tone="teal" />
        <Node i={12} x={830} y={356} w={140} h={96} title="Chief's note" lines={['quotes what the', 'student did']} />
        <Wire i={9} id="c1" d="M200 404 L240 404" /><Wire i={10} id="c2" d="M430 404 L470 404" /><Wire i={11} id="c3" d="M620 404 L660 404" /><Wire i={12} id="c4" d="M790 404 L830 404" />
        <text x={335} y={480} textAnchor="middle" className="w-label">the score never waits on the AI</text>

        <text x={30} y={534} className="row-title">The case desk: the Scout and the Case Builder look for new cases every week</text>
        <Node i={13} x={30} y={560} w={150} h={96} title="News + NASA data" lines={['read weekly by a', 'scheduled job']} />
        <Node i={14} x={205} y={560} w={150} h={96} title="Checklist" lines={['real event? our region?', 'record checked? Code.']} tone="gold" />
        <Node i={15} x={380} y={560} w={150} h={96} title="Scout + Builder" lines={['Gemini screens and', 'writes the brief']} tone="red" />
        <Node i={16} x={555} y={560} w={130} h={96} title="Both guards" lines={['same checks']} tone="teal" />
        <Node i={17} x={710} y={560} w={130} h={96} title="Answer key" lines={['computed by code,', 'kept on the server']} tone="gold" />
        <Node i={18} x={865} y={560} w={110} h={96} title="Human editor" lines={['approves', 'or rejects']} tone="ink" />
        <Wire i={14} id="d1" d="M180 608 L205 608" /><Wire i={15} id="d2" d="M355 608 L380 608" /><Wire i={16} id="d3" d="M530 608 L555 608" />
        <Wire i={17} id="d4" d="M685 608 L710 608" /><Wire i={18} id="d5" d="M840 608 L865 608" />
        <text x={500} y={686} textAnchor="middle" className="w-label">a draft is invisible to students until a person says yes</text>
      </Diagram>
      <p className="note">Tested before launch: 10 attempts to trick the Partner into giving the answer, 0 leaks. If the AI is switched off entirely, the app still works on the approved hints. In the office, the wire desk shows what each agent has been doing: <a href="#/play?at=agency">see the agents at work</a>.</p>
    </section>
  )
}

/** A made-up record used only to animate the method (the same drawing every visit). */
function demoPoints() {
  let s = 21
  return Array.from({ length: 34 }, (_, i) => {
    s = (s * 16807) % 2147483647
    return { x: 40 + i * 12.4, y: 196 - i * 2.5 + ((s / 2147483647) - 0.5) * 78 }
  })
}

const PIPE: [string, string][] = [
  ['Monthly NASA record', 'about 45 years of one measurement for one region of Sarawak'],
  ['Season filter', 'each month minus its 1991–2020 normal, so the yearly cycle cannot fake a trend'],
  ['Ruler: linear regression', 'the least-squares line through the yearly dots, and a 95% range that allows for each year resembling the last'],
  ['Scales: two tests', 'a t-test on the slope and a Mann-Kendall rank test; a trend counts only if both pass and agree'],
  ['El Niño lamp', 'a second regression removes the part explained by the El Niño index, then the Scales run again'],
  ['Stamp', 'significant · not significant · needs more years · record too short'],
]

function Statistics() {
  const pts = demoPoints()
  return (
    <section className="band reveal" id="statistics">
      <p className="eyebrow">Under the hood · 3 of 3</p>
      <h2>The statistics engine</h2>
      <p className="lead">No black box. Every step is classical statistics that a student can follow, and in the lab they do it by hand first: they lay their own regression line, then shuffle the years to see what luck alone can do.</p>
      <div className="stats-grid">
        <div className="diagram pop">
          <svg viewBox="0 0 480 300" role="img" aria-label="An animated example: yearly dots appear, a trend line is drawn through them with its range, and a stamp lands.">
            <line x1={30} y1={250} x2={465} y2={250} className="axis" /><line x1={30} y1={20} x2={30} y2={250} className="axis" />
            <text x={248} y={278} textAnchor="middle" className="w-label">years →</text>
            <path className="band-fill" d="M40 180 L450 78 L450 132 L40 212 Z" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4.2} className="dot" style={{ '--i': i } as React.CSSProperties} />)}
            <path className="draw trend" pathLength={1} d="M40 196 L450 105" />
            <g className="stamp-svg"><rect x={282} y={30} width={170} height={42} rx={4} /><text x={367} y={58} textAnchor="middle">SIGNIFICANT</text></g>
            <text x={40} y={296} className="w-label" textAnchor="start">A made-up record, drawn to show the method.</text>
          </svg>
        </div>
        <ol className="pipe">
          {PIPE.map(([t, d], i) => (
            <li key={t} className="pop"><b>{i + 1}</b><div><strong>{t}</strong><span>{d}</span></div></li>
          ))}
        </ol>
      </div>
      <p className="note">Known-answer tests run before every deploy: made-up records with a built-in trend, no trend, or an El Niño spike must come back with the right stamp. We use regression and rank tests, not machine learning, because a student has to be able to explain the result.</p>
    </section>
  )
}

export function UnderTheHood() {
  return <><Architecture /><Agents /><Statistics /></>
}
