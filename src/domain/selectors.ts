/**
 * Derived values. Pure functions of (state, data) — nothing here mutates and
 * nothing rolls dice, so every one of them is directly testable.
 *
 * Where the booklet is ambiguous the reading is marked ASSUMPTION and listed in
 * the plan's open questions; those are the places to revisit once the printed
 * play aids are transcribed.
 */
import {
  findCommand,
  findLohLevel,
  findOffice,
  findStandingBox,
  findTitle,
  mustRank,
  nextRank,
  ranksInOrder,
} from '../data/lookups'
import type { GameData, RankDef } from '../data/schema'
import type { GameState, Grognard, GrognardId, Lady } from './types'

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/**
 * "Absent" is used throughout the booklet but never defined there. Dead and
 * Retired always count; the other three are configurable via
 * `state.absenceRules` so the reading can be corrected without code changes.
 */
export function isAbsent(state: GameState, g: Grognard): boolean {
  if (g.status.dead || g.status.retired) return true
  const rules = state.absenceRules
  if (rules.prisoner && g.status.prisoner) return true
  if (rules.furlough && g.status.furlough) return true
  if (rules.convalescent && g.status.convalescence !== null) return true
  return false
}

export function isNonAbsent(state: GameState, g: Grognard): boolean {
  return !isAbsent(state, g)
}

export function allGrognards(state: GameState): Grognard[] {
  return state.seatingOrder
    .map((id) => state.grognards[id])
    .filter((g): g is Grognard => g !== undefined)
}

export function livingGrognards(state: GameState): Grognard[] {
  return allGrognards(state).filter((g) => !g.status.dead)
}

export function nonAbsentGrognards(state: GameState): Grognard[] {
  return allGrognards(state).filter((g) => isNonAbsent(state, g))
}

/** Non-absent Grognards in the same Command — the scope for duels and loans. */
export function comradesInCommand(state: GameState, g: Grognard): Grognard[] {
  if (g.commandId === null) return []
  return nonAbsentGrognards(state).filter(
    (other) => other.id !== g.id && other.commandId === g.commandId,
  )
}

/** "We Were There!" and theater checks: Army of the Orient and Spain are separate. */
export function sameTheater(data: GameData, a: Grognard, b: Grognard): boolean {
  const ta = findCommand(data, a.commandId)?.theater ?? 'main'
  const tb = findCommand(data, b.commandId)?.theater ?? 'main'
  return ta === tb
}

// ---------------------------------------------------------------------------
// Senior Grognard
// ---------------------------------------------------------------------------

/** Tie-break order after Rank, exactly as printed: N, G, E, M, H, C, F, S. */
const TIE_BREAK: Array<(state: GameState, data: GameData, g: Grognard) => number> = [
  (_s, _d, g) => g.stats.n,
  (_s, _d, g) => g.stats.g,
  (_s, _d, g) => g.stats.e,
  (_s, _d, g) => g.money.paris + g.money.purse,
  (_s, _d, g) => g.stats.h,
  (_s, _d, g) => g.stats.c,
  (_s, _d, g) => g.stats.f,
  (_s, d, g) => findStandingBox(d, g.standingIndex)?.checkValue ?? g.standingIndex,
]

/**
 * "It's the non-absent Grognard with 1- Highest Rank, then 2- descending order
 * on the Grognard Sheet, 3- Roll if still tied."
 *
 * Returns the winner when the tie-breaks decide it, or the still-tied
 * candidates so the UI can ask for a roll.
 */
export function determineSeniorGrognard(
  state: GameState,
  data: GameData,
): { grognardId: GrognardId | null; tiedIds: GrognardId[] } {
  const candidates = nonAbsentGrognards(state)
  if (candidates.length === 0) return { grognardId: null, tiedIds: [] }

  let pool = candidates
  const rankOrder = (g: Grognard) => mustRank(data, g.rank).order
  const best = Math.max(...pool.map(rankOrder))
  pool = pool.filter((g) => rankOrder(g) === best)

  for (const measure of TIE_BREAK) {
    if (pool.length === 1) break
    const top = Math.max(...pool.map((g) => measure(state, data, g)))
    pool = pool.filter((g) => measure(state, data, g) === top)
  }

  if (pool.length === 1) return { grognardId: pool[0]!.id, tiedIds: [] }
  return { grognardId: null, tiedIds: pool.map((g) => g.id) }
}

/** Seating order rotated so the Senior Grognard is first, then clockwise. */
export function turnOrderFromSenior(state: GameState): Grognard[] {
  const seated = allGrognards(state)
  const sg = state.seniorGrognardId
  if (!sg) return seated
  const start = seated.findIndex((g) => g.id === sg)
  if (start < 0) return seated
  return [...seated.slice(start), ...seated.slice(0, start)]
}

// ---------------------------------------------------------------------------
// Ladies
// ---------------------------------------------------------------------------

export function wifeOf(state: GameState, g: Grognard): Lady | undefined {
  return Object.values(state.ladies).find((l) => l.wifeOf === g.id)
}

export function mistressesOf(state: GameState, g: Grognard): Lady[] {
  return Object.values(state.ladies).filter((l) => l.mistressOf.includes(g.id))
}

export function ladyTotal(lady: Lady): number {
  return lady.qualities.charm + lady.qualities.influence + lady.qualities.money
}

/** The Grognards whose Mistress is this Grognard's Wife. */
export function cuckoldedBy(state: GameState, g: Grognard): GrognardId[] {
  const wife = wifeOf(state, g)
  if (!wife) return []
  return wife.mistressOf.filter((id) => id !== g.id)
}

export function isCuckold(state: GameState, g: Grognard): boolean {
  return cuckoldedBy(state, g).length > 0
}

/**
 * Total Influence usable for a modifier. The Wife's Influence is unavailable
 * for the rest of the Campaign Season after an Indiscretion.
 */
export function usableInfluence(state: GameState, g: Grognard): number {
  const wife = wifeOf(state, g)
  const wifeInfluence = wife && !g.indiscretionThisCS ? wife.qualities.influence : 0
  const mistressInfluence = mistressesOf(state, g).reduce(
    (sum, l) => sum + l.qualities.influence,
    0,
  )
  return wifeInfluence + mistressInfluence
}

// ---------------------------------------------------------------------------
// Income and support
// ---------------------------------------------------------------------------

export interface IncomeBreakdown {
  rank: number
  title: number
  office: number
  loh: number
  total: number
  /** Prisoners receive their income in Paris instead of their Purse. */
  account: 'purse' | 'paris'
  /** Wife's income, always paid into Paris. */
  wife: number
}

/**
 * InG Step 3 / OnC Step 2. Booklet: "Rank (x1.5▲ if ImpGd, x0.5 if Absent) /
 * Highest Title (other than Marechal) / Office (x0.5 if Absent) / LoH (after
 * InG VI-4)" — only Rank and Office carry an Absent modifier; Title and LoH
 * are paid in full even while Absent. Rules Summary Sheet's "Income from all
 * sources halved rounded down" is a looser paraphrase of the same rule; the
 * booklet's own per-component annotation is more precise and is what this
 * follows. Dead Grognards draw no income at all ("no M if dead").
 */
export function incomeFor(state: GameState, data: GameData, g: Grognard): IncomeBreakdown {
  const account: 'purse' | 'paris' = g.status.prisoner ? 'paris' : 'purse'
  if (g.status.dead) {
    return { rank: 0, title: 0, office: 0, loh: 0, total: 0, account, wife: 0 }
  }

  const absent = isAbsent(state, g)
  const command = findCommand(data, g.commandId)
  const rankIncome = mustRank(data, g.rank).income

  // The two Rank modifiers are independent and compose (e.g. a furloughed
  // Imperial Guard officer): apply the Imperial Guard bump first, then halve
  // for Absence, each with its own rounding direction as printed.
  let rank = command?.isImperialGuard ? Math.ceil(rankIncome * 1.5) : rankIncome
  if (absent) rank = Math.floor(rank * 0.5)

  // "Highest Title (other than Marechal)".
  const title = g.titleIds
    .map((id) => findTitle(data, id))
    .filter((t) => t !== undefined && t.countsForIncome)
    .reduce((max, t) => Math.max(max, t!.income), 0)

  const officeIncome = findOffice(data, g.officeId)?.income ?? 0
  const office = absent ? Math.floor(officeIncome * 0.5) : officeIncome

  // LoH pays only once the markers are turned face up after InG VI-4.
  const loh = state.lohBenefitsActive ? (findLohLevel(data, g.lohLevel)?.income ?? 0) : 0

  const wife = (wifeOf(state, g)?.qualities.money ?? 0) * 3

  return { rank, title, office, loh, total: rank + title + office + loh, account, wife }
}

/** Glory from the Legion of Honor, paid in Segment Step 5 once revealed. */
export function lohGlory(state: GameState, data: GameData, g: Grognard): number {
  if (!state.lohBenefitsActive) return 0
  return findLohLevel(data, g.lohLevel)?.glory ?? 0
}

export interface SupportCosts {
  /** Wife's (C)+(I)+(M), paid from Paris. */
  wife: number
  /** Per Mistress: ((C)+(I)+(M)) ÷ 2 ▼, paid from the Purse. */
  mistresses: Array<{ ladyId: string; name: string; cost: number }>
}

export function supportCosts(state: GameState, g: Grognard): SupportCosts {
  const wife = wifeOf(state, g)
  return {
    wife: wife ? ladyTotal(wife) : 0,
    mistresses: mistressesOf(state, g).map((l) => ({
      ladyId: l.id,
      name: l.name,
      cost: Math.floor(ladyTotal(l) / 2),
    })),
  }
}

// ---------------------------------------------------------------------------
// Standing
// ---------------------------------------------------------------------------

/** The parenthesised number on the Standing track — the "(S)" used in checks. */
export function standingCheckValue(data: GameData, g: Grognard): number | undefined {
  return findStandingBox(data, g.standingIndex)?.checkValue
}

export function standingLabel(data: GameData, g: Grognard): string {
  return findStandingBox(data, g.standingIndex)?.label ?? `#${g.standingIndex}`
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export interface RankEligibility {
  rank: RankDef
  eligible: boolean
  /** What was missing, for display next to the failed requirement. */
  shortfall: { n: number; g: number; e: number }
}

/**
 * "Meet minimum requirements of N, G & E for new Rank. N not required until
 * CS VI. May substitute excess N for G, excess G/2 for E."
 *
 * The substitutions chain (excess N raises effective G, whose excess then
 * raises effective E), which is the reading most favourable to the player and
 * matches "Give Rank = highest possible with the new stats". The Grognard
 * Sheet annotates this exact chain on its Glory/Experience rows — "(N1→G1)"
 * and "(G2→E1)" — confirming both the 1:1 N→G ratio and that G→E rounds down
 * (2 excess G per 1 E, remainder dropped).
 */
export function rankEligibility(
  g: Grognard,
  rank: RankDef,
  campaignSeason: number,
): RankEligibility {
  const req = rank.requirements
  const noticeRequired = campaignSeason >= 6

  const nShort = noticeRequired ? Math.max(0, req.n - g.stats.n) : 0
  const excessN = noticeRequired ? Math.max(0, g.stats.n - req.n) : g.stats.n
  const effectiveG = g.stats.g + excessN
  const gShort = Math.max(0, req.g - effectiveG)
  const excessG = Math.max(0, effectiveG - req.g)
  const effectiveE = g.stats.e + Math.floor(excessG / 2)
  const eShort = Math.max(0, req.e - effectiveE)

  return {
    rank,
    eligible: nShort === 0 && gShort === 0 && eShort === 0,
    shortfall: { n: nShort, g: gShort, e: eShort },
  }
}

/** The highest rank the Grognard currently qualifies for. Never demotes. */
export function highestEligibleRank(
  data: GameData,
  g: Grognard,
  campaignSeason: number,
): RankDef {
  const current = mustRank(data, g.rank)
  let best = current
  for (const rank of ranksInOrder(data)) {
    if (rank.order <= current.order) continue
    if (rankEligibility(g, rank, campaignSeason).eligible) best = rank
  }
  return best
}

/** Whether a promotion is available right now (booklet: "Promotion — New Rank"). */
export function canBePromoted(
  state: GameState,
  data: GameData,
  g: Grognard,
  campaignSeason: number,
): boolean {
  // "Not if KIA. Not if Prisoner until he is exchanged."
  if (g.status.dead || g.status.prisoner) return false
  const next = nextRank(data, mustRank(data, g.rank))
  if (!next) return false
  // Marechal additionally requires the Grand Review at Boulogne.
  if (next.id === 'marechal' && !state.grandReviewAtBoulogneDone) return false
  return highestEligibleRank(data, g, campaignSeason).order > mustRank(data, g.rank).order
}

// ---------------------------------------------------------------------------
// Court / Propose
// ---------------------------------------------------------------------------

export interface Attractiveness {
  charm: number
  money: number
  rank: number
  office: number
  title: number
  ardor: number
  total: number
  /** Lady's (C)+(I)+(M). */
  ladyTotal: number
  /** Attractiveness − Lady's total. 0 or less means the attempt is impossible. */
  probability: number
}

/**
 * Play aid "Court/Propose". ASSUMPTION: only the highest title's bonus counts
 * (5 Comte / 10 Duc / 15 Prince), not the sum of all held titles.
 */
export function attractiveness(
  data: GameData,
  g: Grognard,
  lady: Lady,
  kind: 'court' | 'propose',
): Attractiveness {
  const lowest = ranksInOrder(data)[0]
  const rankScore = mustRank(data, g.rank).order - (lowest?.order ?? 0)

  const titleScore = g.titleIds
    .map((id) => findTitle(data, id)?.attractiveness ?? 0)
    .reduce((max, v) => Math.max(max, v), 0)

  const ardorEntry = lady.ardor.find((a) => a.grognardId === g.id)
  const ardor = kind === 'court' ? (ardorEntry?.courting ?? 0) : (ardorEntry?.proposing ?? 0)

  const parts = {
    charm: g.stats.c,
    money: Math.floor((g.money.paris + g.money.purse) / 25),
    rank: rankScore,
    office: g.officeId ? 5 : 0,
    title: titleScore,
    ardor,
  }
  const total = parts.charm + parts.money + parts.rank + parts.office + parts.title + parts.ardor
  const total0 = ladyTotal(lady)

  return { ...parts, total, ladyTotal: total0, probability: total - total0 }
}

/** "A Grognard may have max 1 Wife and 2 Mistresses", plus the never-again bars. */
export function canAttemptWithLady(
  state: GameState,
  g: Grognard,
  lady: Lady,
  kind: 'court' | 'propose',
): { allowed: boolean; reason?: string } {
  const barred = lady.barred.find((b) => b.grognardId === g.id)
  if (kind === 'court' && barred?.court) return { allowed: false, reason: 'May never court her again' }
  if (kind === 'propose' && barred?.propose)
    return { allowed: false, reason: 'May never propose to her again' }

  if (kind === 'propose') {
    if (wifeOf(state, g)) return { allowed: false, reason: 'Already has a Wife' }
    if (lady.wifeOf !== null) return { allowed: false, reason: 'She is already a Wife' }
  } else {
    if (mistressesOf(state, g).length >= 2)
      return { allowed: false, reason: 'Already has 2 Mistresses' }
    if (lady.mistressOf.includes(g.id)) return { allowed: false, reason: 'Already his Mistress' }
  }
  return { allowed: true }
}
