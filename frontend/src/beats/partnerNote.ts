// Why a Partner reply is an approved hint rather than the AI's own words, in the Partner's voice.
// Shared by the lite Partner box and the 3D guide. AI-assisted: written with Claude Code.
import type { PartnerReply } from '../api/types'

const NOTE: Record<NonNullable<PartnerReply['fallback']>, string> = {
  guarded: "That one is yours to work out, Detective, so here's a hint instead:",
  busy: "I took too long thinking about that. Here's a hint for now; ask again in a moment:",
  off: "Here's a hint from the case notes:",
}

/** A note to show above the reply, or undefined when the AI answered (or a plain hint was asked for). */
export function partnerNote(r: PartnerReply, asked: boolean): string | undefined {
  if (r.source !== 'ladder' || !r.fallback) return undefined
  if (!asked && r.fallback === 'off') return undefined
  return NOTE[r.fallback]
}
