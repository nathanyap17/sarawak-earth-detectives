// App shell. Lite mode first; the 3D office layers on top (MASTER_SHEET §19).
// AI-assisted: scaffolded with Claude Code.
import { useEffect, useState } from 'react'
import { api } from './api/client'

export default function App() {
  const [status, setStatus] = useState('checking backend…')
  useEffect(() => {
    api.health().then((h) => setStatus(`backend ok (${h.env})`)).catch(() => setStatus('backend offline'))
  }, [])
  return (
    <main style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1>Sarawak Earth Detectives</h1>
      <p>Real events. Real NASA data. You're the detective.</p>
      <small>{status}</small>
    </main>
  )
}
