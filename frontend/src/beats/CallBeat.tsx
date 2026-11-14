// Beat 1, The Call: the Client's brief arrives; the student signs the folder.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CasePublic } from '../api/types'
import { useSession } from '../state/session'

export function CallBeat() {
  const { nickname, setNickname, begin } = useSession()
  const [cases, setCases] = useState<CasePublic[] | null>(null)
  const [pick, setPick] = useState<CasePublic | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.cases().then((c) => { setCases(c); if (c.length === 1) setPick(c[0]) })
      .catch(() => setErr('The agency line is down. Is the backend running?'))
  }, [])

  async function sign() {
    if (!pick) return
    setBusy(true)
    try {
      const s = await api.startSession(pick.id, nickname.trim() || 'Detective')
      begin(pick, s.id)
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  if (err) return <p className="error">{err}</p>
  if (!cases) return <p className="muted">The phone is ringing…</p>

  return (
    <section className="beat">
      {cases.length > 1 && (
        <div className="case-list" role="list">
          {cases.map((c) => (
            <button key={c.id} role="listitem" className={`case-tab ${pick?.id === c.id ? 'on' : ''}`} onClick={() => setPick(c)}>
              Case {c.id}: {c.title}
            </button>
          ))}
        </div>
      )}
      {pick && (
        <article className="folder">
          <p className="folder-tab">Case {pick.id} · {pick.type}</p>
          <h2>{pick.title}</h2>
          <blockquote className="brief">“{pick.brief}”<footer>— The Client</footer></blockquote>
          <p className="question"><strong>The question:</strong> {pick.question}</p>
          <details>
            <summary>News clipping{pick.sources.length > 1 ? 's' : ''}</summary>
            <ul>{pick.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> ({s.date})</li>
            ))}</ul>
          </details>
          <label className="field">
            Your detective name (no real names, please)
            <input value={nickname} maxLength={24} onChange={(e) => setNickname(e.target.value)} />
          </label>
          <button className="primary" disabled={busy || !nickname.trim()} onClick={sign}>
            {busy ? 'Opening the folder…' : 'Sign the case folder'}
          </button>
        </article>
      )}
    </section>
  )
}
