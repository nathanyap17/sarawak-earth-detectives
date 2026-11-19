// Medals for closed cases: the metal says how well the case was argued, the ribbon how it ended,
// and each skill badge has its own colour (shown as a gem on the shelf medal and a dot on screen).
// Shared by the Case Closed beat (2D and 3D), the inbox and the shelf in the 3D office.
// AI-assisted: written with Claude Code.
import type { Badge, Ending } from '../api/types'

export type Tier = 'gold' | 'silver' | 'bronze'

export function tierOf(score: number): Tier {
  return score >= 85 ? 'gold' : score >= 70 ? 'silver' : 'bronze'
}

export const TIER: Record<Tier, { name: string; title: string; metal: string; shine: string }> = {
  gold:   { name: 'Gold',   title: 'Master Detective', metal: '#d9a521', shine: '#fff1b0' },
  silver: { name: 'Silver', title: 'Sharp Detective',  metal: '#b9c2cc', shine: '#f4f8fb' },
  bronze: { name: 'Bronze', title: 'Case Cracker',     metal: '#b8733c', shine: '#f3c9a0' },
}

/** Ribbon colour by ending: Sarawak red for a solved trend, deep blue for honest doubt. */
export const RIBBON: Record<Exclude<Ending, 'sent_back'>, { colour: string; words: string }> = {
  solved: { colour: '#c8102e', words: 'Trend solved' },
  solved_not_enough: { colour: '#2f5fa8', words: 'Honest doubt' },
}

export const BADGES: Record<Badge, { name: string; what: string; colour: string }> = {
  clean_signal:   { name: 'Clean Signal',   what: 'Removed the seasons before testing',         colour: '#1fa59a' },
  red_herring:    { name: 'Red Herring',    what: 'Rejected irrelevant evidence',               colour: '#d6334a' },
  honest_doubt:   { name: 'Honest Doubt',   what: 'Correctly said the record can’t settle it',  colour: '#4f6bdc' },
  second_opinion: { name: 'Second Opinion', what: 'Weighed more than one record',               colour: '#e3a51c' },
  twin_trail:     { name: 'Twin Trail',     what: 'Compared two regions',                       colour: '#9157d6' },
  elnino_eye:     { name: 'El Niño Eye',    what: 'Checked the El Niño effect',                 colour: '#f07a28' },
}
