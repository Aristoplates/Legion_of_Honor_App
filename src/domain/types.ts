/**
 * The game state. Deliberately free of React and of any data-table values:
 * every rules constant lives in src/data, so this file only describes shape.
 *
 * Terminology follows the rulebook and the play aids (English), including the
 * single-letter stats: N Napoleon's Notice, G Glory, E Experience, H Health,
 * C Charm, F Fencing, S Standing, M Money.
 */

export type GrognardId = string
export type LadyId = string
export type RankId = string
export type CommandId = string
export type TitleId = string
export type OfficeId = string

export const SCHEMA_VERSION = 1

/** The six numeric stats that cards and steps add to or subtract from. */
export interface Stats {
  n: number
  g: number
  e: number
  h: number
  c: number
  f: number
}

export interface Money {
  paris: number
  purse: number
}

/**
 * Convalescence. `fullRounds` counts *completed* rounds spent convalescing,
 * which is what the Recovery formula multiplies (booklet InG Step 2).
 */
export interface Convalescence {
  woundLevelId: string
  fullRounds: number
}

export interface Grognard {
  id: GrognardId
  name: string
  /** Counter colour, used to tell Grognards apart at a glance. */
  color: string

  rank: RankId
  stats: Stats
  money: Money

  /** Index into the Standing track. Frozen once the "hat" counter is placed. */
  standingIndex: number
  hasHatCounter: boolean

  /** null = Army Staff / not assigned to any Command. */
  commandId: CommandId | null

  /** 0 = no Legion of Honor. Benefits only apply once game-wide LoH is revealed. */
  lohLevel: number

  titleIds: TitleId[]
  officeId: OfficeId | null
  /** Corruption: "Found Out" bars the Grognard from office for the rest of his life. */
  officeBarredForLife: boolean

  status: {
    dead: boolean
    prisoner: boolean
    /** Voluntary or involuntary retirement (Health = 0). */
    retired: boolean
    furlough: boolean
    /** null = fit for duty. Can coexist with `prisoner`. */
    convalescence: Convalescence | null
  }

  /** Wounds since the most recent death, excluding duels — Imperial Guard request. */
  woundsSinceDeath: number

  /** Cleared each Campaign Season. Blocks the use of the Wife's Influence. */
  indiscretionThisCS: boolean

  /** Declared in card 38 "The Abdication" — prerequisite for a Waterloo title. */
  bonapartist: boolean

  /** Reset every round. Zeal may not be used on the 3rd card of a round. */
  cardsDrawnThisRound: number
  /** Set by Zeal: the next card is ignored unless it is an Event or End of Round?. */
  skipNextCard: boolean
}

export interface Lady {
  id: LadyId
  name: string
  /** Values on the printed Charm / Influence / Money tracks. */
  qualities: { charm: number; influence: number; money: number }
  wifeOf: GrognardId | null
  /** A Lady may be the Mistress of any number of Grognards. */
  mistressOf: GrognardId[]
  /**
   * Failed attempts, which raise Attractiveness on the next try. Courting and
   * Proposing track Ardor separately (play aid: "Courting Ardor only for
   * Courting. Same for Proposal").
   */
  ardor: Array<{ grognardId: GrognardId; courting: number; proposing: number }>
  /** Set after a Divorce (never propose/court again) or a lost Mistress (never court). */
  barred: Array<{ grognardId: GrognardId; court: boolean; propose: boolean }>
}

/**
 * Rules Summary Sheet, "Injured Party": disgracing the command, insult,
 * Card 52 (an insult, folded into 'insult' here), loan terms violated to the
 * lender's disadvantage, mortal enemy (a specific card/event effect), or
 * being made a cuckold.
 */
export type InjuryReason = 'disgrace' | 'insult' | 'loanTerms' | 'cuckoldry' | 'mortalEnemy'

/**
 * An Injured Party relation. Held as an explicit record because it lasts
 * "until he Challenges the offending Grognard" — a fact the board position
 * alone does not carry.
 */
export interface Injury {
  id: string
  victimId: GrognardId
  offenderId: GrognardId
  reason: InjuryReason
  /** Campaign Season it arose in; Loan Terms allow one challenge per CS. */
  campaignSeason: number
  resolved: boolean
}

export interface Loan {
  id: string
  lenderId: GrognardId
  borrowerId: GrognardId
  amount: number
  /** Free text: "made on any terms, made known to all Grognards". */
  terms: string
  campaignSeason: number
  repaid: boolean
}

export type Phase =
  | { kind: 'setup' }
  | { kind: 'segment' }
  | { kind: 'inGarrison'; round: number }
  | { kind: 'onCampaign'; round: number }
  | { kind: 'endGame' }

export interface OptionalRules {
  fairSex: boolean
  spain: boolean
  other: boolean
}

/**
 * How the app reads "Absent", used throughout the booklet but only defined
 * in the Rules Summary Sheet: "Through furlough, convalescence, retirement,
 * death, or prisoner." Kept configurable (rather than hardcoded) in case a
 * table variant plays it differently, but the defaults below are that
 * confirmed definition, not a guess. Dead and Retired are always absent
 * regardless of these flags.
 */
export interface AbsenceRules {
  prisoner: boolean
  furlough: boolean
  convalescent: boolean
}

export const DEFAULT_ABSENCE_RULES: AbsenceRules = {
  prisoner: true,
  furlough: true,
  convalescent: true,
}

export interface GameState {
  schemaVersion: number
  id: string
  name: string
  createdAt: string

  optionalRules: OptionalRules
  absenceRules: AbsenceRules

  /** 1..16 */
  campaignSeason: number
  phase: Phase

  /** Locked for the entire Segment / Round once determined. */
  seniorGrognardId: GrognardId | null
  /** Seating order; card dealing and "clockwise" rotation follow it. */
  seatingOrder: GrognardId[]

  /** True after In Garrison round VI-4: LoH markers turn face up. */
  lohBenefitsActive: boolean
  /** Prerequisite for the Marechal rank and title. */
  grandReviewAtBoulogneDone: boolean

  grognards: Record<GrognardId, Grognard>
  ladies: Record<LadyId, Lady>
  injuries: Injury[]
  loans: Loan[]
}

export const ZERO_STATS: Stats = { n: 0, g: 0, e: 0, h: 0, c: 0, f: 0 }

/** Hard bounds applied by the reducer after every change. */
export const STAT_BOUNDS: Record<keyof Stats, { min: number; max: number }> = {
  n: { min: 0, max: 100 },
  g: { min: 0, max: Number.MAX_SAFE_INTEGER },
  e: { min: 0, max: Number.MAX_SAFE_INTEGER },
  h: { min: 0, max: 100 },
  c: { min: 0, max: Number.MAX_SAFE_INTEGER },
  f: { min: 0, max: Number.MAX_SAFE_INTEGER },
}
