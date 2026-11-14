// The ONLY module that calls the backend. AI-assisted: scaffolded with Claude Code.
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${r.status} ${path}`)
  return r.json() as Promise<T>
}

export const api = {
  health: () => get<{ ok: boolean; env: string; data_backend: string }>('/health'),
}
