// App shell: the 3D office by default, lite (2D) mode when the device can't or shouldn't run 3D,
// and a manual switch both ways (MASTER_SHEET §19, PLAN Phase 3.5). Both modes share one store,
// so switching keeps the investigation. The office is code-split so lite stays light.
// AI-assisted: written with Claude Code.
import { lazy, Suspense, useState } from 'react'
import { LiteApp } from './lite/LiteApp'
import { liteReason, saveMode, savedMode, webglOk, type Mode } from './office/capability'

const OfficeApp = lazy(() => import('./office/OfficeApp').then((m) => ({ default: m.OfficeApp })))

export default function App() {
  const [reason] = useState(liteReason)
  const [mode, setMode] = useState<Mode>(() => (webglOk() ? savedMode() : 'lite') ?? (reason ? 'lite' : '3d'))
  const pick = (m: Mode) => { saveMode(m); setMode(m) }
  if (mode === 'lite') return <LiteApp onOffice={webglOk() ? () => pick('3d') : undefined} note={reason} />
  return (
    <Suspense fallback={<p className="muted" style={{ padding: 16 }}>Opening the office…</p>}>
      <OfficeApp onLite={() => pick('lite')} />
    </Suspense>
  )
}
