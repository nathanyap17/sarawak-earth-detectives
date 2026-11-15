// App shell. "/" is the front page (LANDING.md); "/#/play" is the app: the 3D office by default,
// lite (2D) mode when the device can't or shouldn't run 3D, and a manual switch both ways
// (MASTER_SHEET §19). Both modes share one store, so switching keeps the investigation.
// The landing page and the office are code-split, so each loads only what it needs.
// AI-assisted: written with Claude Code.
import { lazy, Suspense, useEffect, useState } from 'react'
import { LiteApp } from './lite/LiteApp'
import { liteReason, saveMode, savedMode, webglOk, type Mode } from './office/capability'

const OfficeApp = lazy(() => import('./office/OfficeApp').then((m) => ({ default: m.OfficeApp })))
const Landing = lazy(() => import('./landing/Landing').then((m) => ({ default: m.Landing })))

const Review = lazy(() => import('./beats/Review').then((m) => ({ default: m.Review })))

const playing = () => window.location.hash.startsWith('#/play')
const reviewing = () => window.location.hash.startsWith('#/review')

export default function App() {
  const [play, setPlay] = useState(playing)
  const [review, setReview] = useState(reviewing)
  const [reason] = useState(liteReason)
  const [mode, setMode] = useState<Mode>(() => (webglOk() ? savedMode() : 'lite') ?? (reason ? 'lite' : '3d'))
  useEffect(() => {
    const on = () => { setPlay(playing()); setReview(reviewing()) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const pick = (m: Mode) => { saveMode(m); setMode(m) }
  const home = () => { window.location.hash = '' }

  if (review) return <Suspense fallback={null}><Review /></Suspense>
  if (!play) {
    return (
      <Suspense fallback={<div style={{ background: '#07090f', minHeight: '100vh' }} />}>
        <Landing onEnter={() => { window.location.hash = '#/play'; window.scrollTo({ top: 0 }) }} />
      </Suspense>
    )
  }
  if (mode === 'lite') return <LiteApp onOffice={webglOk() ? () => pick('3d') : undefined} note={reason} />
  return (
    <Suspense fallback={<div className="office"><p className="stage-boot" role="status">Opening the office…</p></div>}>
      <OfficeApp onLite={() => pick('lite')} onHome={home} />
    </Suspense>
  )
}
