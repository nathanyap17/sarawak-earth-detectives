// Decide whether this device should get the 3D office or the lite (2D) mode (PLAN Phase 3.5, §19).
// AI-assisted: written with Claude Code.
export type Mode = '3d' | 'lite'

export function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/** Why this device starts in lite mode, or null if 3D is fine. */
export function liteReason(): string | null {
  if (!webglOk()) return 'This browser has no WebGL, so the office is shown in 2D.'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'Reduced motion is on, so the office is shown in 2D.'
  if (window.innerWidth < 768) return 'Small screen, so the office is shown in 2D.'
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if ((mem !== undefined && mem <= 2) || (navigator.hardwareConcurrency || 4) <= 2) return 'Light device, so the office is shown in 2D.'
  return null
}

const KEY = 'sed-mode'
export function savedMode(): Mode | null {
  try { const v = localStorage.getItem(KEY); return v === '3d' || v === 'lite' ? v : null } catch { return null }
}
export function saveMode(m: Mode) { try { localStorage.setItem(KEY, m) } catch { /* private mode */ } }
