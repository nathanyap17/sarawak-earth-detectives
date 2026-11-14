// Collects what the guide needs to know from the two stores.
// AI-assisted: written with Claude Code.
import { BEATS, useSession } from '../state/session'
import { stampedCount, type GuideState } from './script'
import { useUI } from './ui'

export function useGuideState(): GuideState {
  const s = useSession()
  const win = useUI((u) => u.win)
  const inboxSeen = useUI((u) => u.inboxSeen)
  return {
    hasCase: !!s.activeCase, beat: BEATS[s.reached], win, pins: s.cluePins.length, chosen: s.chosen.length,
    opened: s.opened.length, stamped: stampedCount(s.results, s.chosen), herring: s.herringWarning,
    graded: !!s.grade, sentBack: s.grade?.ending === 'sent_back', inboxSeen,
  }
}
