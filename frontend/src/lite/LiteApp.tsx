// Lite mode: the seven beats as flat pages (MASTER_SHEET §5.4, §19). Built first; the 3D
// office will reuse the same beats and state.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { logQuiet } from '../api/client'
import { Agency } from '../beats/Agency'
import { BoardBeat } from '../beats/BoardBeat'
import { CallBeat } from '../beats/CallBeat'
import { ClosedBeat } from '../beats/ClosedBeat'
import { DeductionBeat } from '../beats/DeductionBeat'
import { LabBeat } from '../beats/LabBeat'
import { LockerBeat } from '../beats/LockerBeat'
import { Partner } from '../beats/Partner'
import { SceneBeat } from '../beats/SceneBeat'
import { BEAT_LABEL, BEATS, useSession, type Beat } from '../state/session'
import { SettingsMenu } from '../sound/Settings'

export function LiteApp({ onOffice, note }: { onOffice?: () => void; note?: string | null } = {}) {
  const { beat, setBeat, sessionId, activeCase, reset } = useSession()
  const go = (b: Beat) => { setBeat(b); window.scrollTo({ top: 0 }) }
  useEffect(() => { logQuiet(sessionId, { kind: 'beat', beat }) }, [beat, sessionId])

  const idx = BEATS.indexOf(beat)
  const [wire, setWire] = useState(false)
  return (
    <div className="lite">
      <header className="top">
        <h1><img className="brand-logo" src="/brand/logo-128.webp" width="30" height="30" alt="" />Sarawak Earth Detectives</h1>
        <span className="top-right">
          {activeCase && <span className="case-chip">Case {activeCase.id}</span>}
          <button className="mode" onClick={() => setWire(!wire)} aria-expanded={wire}>📠 Agents at work</button>
          {onOffice && <button className="mode" onClick={onOffice} aria-label="Switch to the 3D office">3D office</button>}
          <SettingsMenu />
        </span>
      </header>
      {note && <p className="muted lite-note">{note}{onOffice && ' You can still try the 3D office.'}</p>}
      <nav className="beats" aria-label="Investigation progress">
        <ol>{BEATS.map((b, i) => (
          <li key={b} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span>{i + 1}</span><em>{BEAT_LABEL[b]}</em>
          </li>
        ))}</ol>
      </nav>
      {wire && <aside className="wire-panel" aria-label="Agents at work"><h2>Agents at work</h2><Agency /></aside>}
      <main>
        {beat === 'call' && <CallBeat />}
        {beat === 'scene' && <SceneBeat onDone={() => go('locker')} />}
        {beat === 'locker' && <LockerBeat onDone={() => go('board')} />}
        {beat === 'board' && <BoardBeat onDone={() => go('lab')} />}
        {beat === 'lab' && <LabBeat onDone={() => go('deduction')} />}
        {beat === 'deduction' && <DeductionBeat onDone={() => go('closed')} />}
        {beat === 'closed' && <ClosedBeat onRetry={() => go('deduction')} onShelf={() => { reset(); go('call') }} />}
        <Partner />
      </main>
      <footer className="foot">
        Data: NASA POWER (MERRA-2), NASA GIBS (VIIRS), NOAA RONI. Numbers come from statistics code, not AI.
      </footer>
    </div>
  )
}
