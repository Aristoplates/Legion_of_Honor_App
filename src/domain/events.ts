/**
 * Event log and reducer.
 *
 * Every change to the game is an event appended to a log; the state is the
 * fold of that log. This buys three things that matter at a game table:
 * dependable undo, a readable journal per Grognard ("what happened to my
 * character"), and the ability to re-check a disputed result afterwards.
 *
 * Events must therefore be self-contained and their application deterministic:
 * no clocks, no randomness, no table lookups inside the reducer. Dice are
 * rolled *before* the event is created and travel with it.
 */
import { newId } from './factories'
import {
  DEFAULT_ABSENCE_RULES,
  SCHEMA_VERSION,
  STAT_BOUNDS,
  type AbsenceRules,
  type CommandId,
  type Convalescence,
  type GameState,
  type Grognard,
  type GrognardId,
  type Injury,
  type Lady,
  type LadyId,
  type Loan,
  type Money,
  type OfficeId,
  type OptionalRules,
  type Phase,
  type RankId,
  type Stats,
  type TitleId,
} from './types'

/** A die roll as it happened, kept for the journal. */
export interface RollRecord {
  label: string
  /** Booklet notation, e.g. "1d10÷3▼". Absent for plain "roll a d10" prompts. */
  formula?: string
  raw: number
  value: number
  /** True when the player typed the result of physical dice. */
  entered: boolean
}

interface EventMeta {
  id: string
  at: string
  /** Journal headline, e.g. "Segment Step 3: Aging". */
  label: string
  /** Grognards this event concerns, for filtering the log. */
  subjects: GrognardId[]
  rolls?: RollRecord[]
  note?: string
}

export type StatusChange = Partial<{
  dead: boolean
  prisoner: boolean
  retired: boolean
  furlough: boolean
}>

type EventBody =
  // --- game / bookkeeping -------------------------------------------------
  | { type: 'GAME_CREATED'; name: string; id: string; optionalRules: OptionalRules }
  | { type: 'PHASE_SET'; campaignSeason: number; phase: Phase }
  | { type: 'SENIOR_GROGNARD_SET'; grognardId: GrognardId | null }
  | { type: 'SEATING_ORDER_SET'; order: GrognardId[] }
  | { type: 'OPTIONAL_RULES_SET'; rules: OptionalRules }
  | { type: 'ABSENCE_RULES_SET'; rules: AbsenceRules }
  | { type: 'GAME_FLAG_SET'; flag: 'lohBenefitsActive' | 'grandReviewAtBoulogneDone'; value: boolean }
  /** Journal-only entry: a roll with no mechanical effect, or a player note. */
  | { type: 'NOTE' }

  // --- grognard -----------------------------------------------------------
  | { type: 'GROGNARD_ADDED'; grognard: Grognard }
  | { type: 'GROGNARD_RENAMED'; grognardId: GrognardId; name: string; color: string }
  | { type: 'STAT_DELTA'; grognardId: GrognardId; changes: Partial<Stats> }
  | { type: 'STAT_SET'; grognardId: GrognardId; changes: Partial<Stats> }
  | { type: 'MONEY_DELTA'; grognardId: GrognardId; changes: Partial<Money> }
  | { type: 'MONEY_SET'; grognardId: GrognardId; changes: Partial<Money> }
  | { type: 'RANK_SET'; grognardId: GrognardId; rankId: RankId }
  | { type: 'STANDING_SET'; grognardId: GrognardId; index: number }
  | { type: 'STANDING_DELTA'; grognardId: GrognardId; delta: number; maxIndex: number }
  | { type: 'HAT_COUNTER_PLACED'; grognardId: GrognardId; index: number }
  | { type: 'COMMAND_SET'; grognardId: GrognardId; commandId: CommandId | null }
  | { type: 'LOH_LEVEL_DELTA'; grognardId: GrognardId; delta: number; maxLevel: number }
  | { type: 'TITLE_AWARDED'; grognardId: GrognardId; titleId: TitleId }
  | { type: 'TITLE_REMOVED'; grognardId: GrognardId; titleId: TitleId }
  | { type: 'TITLES_CLEARED'; grognardId: GrognardId }
  | { type: 'OFFICE_SET'; grognardId: GrognardId; officeId: OfficeId | null }
  | { type: 'OFFICE_BARRED_FOR_LIFE'; grognardId: GrognardId }
  | { type: 'STATUS_SET'; grognardId: GrognardId; changes: StatusChange }
  | { type: 'CONVALESCENCE_SET'; grognardId: GrognardId; convalescence: Convalescence | null }
  /** End of a round: every convalescing Grognard completes another round. */
  | { type: 'CONVALESCENCE_TICKED' }
  | { type: 'WOUND_RECORDED'; grognardId: GrognardId; fromDuel: boolean }
  | { type: 'INDISCRETION_SET'; grognardId: GrognardId; value: boolean }
  | { type: 'BONAPARTIST_SET'; grognardId: GrognardId; value: boolean }
  | { type: 'CARD_DRAWN'; grognardId: GrognardId }
  | { type: 'ZEAL_USED'; grognardId: GrognardId }
  | { type: 'SKIP_NEXT_CARD_CLEARED'; grognardId: GrognardId }
  | { type: 'ROUND_COUNTERS_RESET' }

  // --- ladies -------------------------------------------------------------
  | { type: 'LADY_ADDED'; lady: Lady }
  | { type: 'LADY_REMOVED'; ladyId: LadyId }
  | {
      type: 'LADY_QUALITIES_SET'
      ladyId: LadyId
      qualities: { charm: number; influence: number; money: number }
    }
  | { type: 'MARRIED'; ladyId: LadyId; grognardId: GrognardId }
  | { type: 'DIVORCED'; ladyId: LadyId; grognardId: GrognardId }
  | { type: 'MISTRESS_TAKEN'; ladyId: LadyId; grognardId: GrognardId }
  | { type: 'MISTRESS_LOST'; ladyId: LadyId; grognardId: GrognardId; barCourt: boolean }
  | { type: 'ARDOR_ADDED'; ladyId: LadyId; grognardId: GrognardId; kind: 'court' | 'propose' }
  | { type: 'ARDOR_CLEARED'; ladyId: LadyId }

  // --- relations ----------------------------------------------------------
  | { type: 'INJURY_ADDED'; injury: Injury }
  | { type: 'INJURIES_RESOLVED'; injuryIds: string[] }
  | { type: 'LOAN_MADE'; loan: Loan }
  | { type: 'LOAN_REPAID'; loanId: string }

export type GameEvent = EventMeta & EventBody
export type GameEventBody = EventBody

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptyState(id: string, name: string, createdAt: string): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    createdAt,
    optionalRules: { fairSex: false, spain: false, other: false },
    absenceRules: { ...DEFAULT_ABSENCE_RULES },
    campaignSeason: 1,
    phase: { kind: 'setup' },
    seniorGrognardId: null,
    seatingOrder: [],
    lohBenefitsActive: false,
    grandReviewAtBoulogneDone: false,
    grognards: {},
    ladies: {},
    injuries: [],
    loans: [],
  }
}

function clampStat(key: keyof Stats, value: number): number {
  const bounds = STAT_BOUNDS[key]
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}

function clampStats(stats: Stats): Stats {
  return {
    n: clampStat('n', stats.n),
    g: clampStat('g', stats.g),
    e: clampStat('e', stats.e),
    h: clampStat('h', stats.h),
    c: clampStat('c', stats.c),
    f: clampStat('f', stats.f),
  }
}

/** Throws a message naming the missing Grognard rather than yielding undefined. */
export function mustGrognard(state: GameState, id: GrognardId): Grognard {
  const g = state.grognards[id]
  if (!g) throw new Error(`Unknown Grognard "${id}"`)
  return g
}

export function mustLady(state: GameState, id: LadyId): Lady {
  const l = state.ladies[id]
  if (!l) throw new Error(`Unknown Lady "${id}"`)
  return l
}

/** Replaces one Grognard, leaving the rest of the state untouched. */
function withGrognard(
  state: GameState,
  id: GrognardId,
  update: (g: Grognard) => Grognard,
): GameState {
  const current = mustGrognard(state, id)
  return { ...state, grognards: { ...state.grognards, [id]: update(current) } }
}

function withLady(state: GameState, id: LadyId, update: (l: Lady) => Lady): GameState {
  const current = mustLady(state, id)
  return { ...state, ladies: { ...state.ladies, [id]: update(current) } }
}

function addStats(stats: Stats, changes: Partial<Stats>): Stats {
  return clampStats({
    n: stats.n + (changes.n ?? 0),
    g: stats.g + (changes.g ?? 0),
    e: stats.e + (changes.e ?? 0),
    h: stats.h + (changes.h ?? 0),
    c: stats.c + (changes.c ?? 0),
    f: stats.f + (changes.f ?? 0),
  })
}

/** Ardor is tracked separately for Courting and Proposing. */
function bumpArdor(lady: Lady, grognardId: GrognardId, kind: 'court' | 'propose'): Lady {
  const existing = lady.ardor.find((a) => a.grognardId === grognardId)
  const next = existing
    ? lady.ardor.map((a) =>
        a.grognardId === grognardId
          ? {
              ...a,
              courting: a.courting + (kind === 'court' ? 1 : 0),
              proposing: a.proposing + (kind === 'propose' ? 1 : 0),
            }
          : a,
      )
    : [
        ...lady.ardor,
        {
          grognardId,
          courting: kind === 'court' ? 1 : 0,
          proposing: kind === 'propose' ? 1 : 0,
        },
      ]
  return { ...lady, ardor: next }
}

function setBarred(
  lady: Lady,
  grognardId: GrognardId,
  change: { court?: boolean; propose?: boolean },
): Lady {
  const existing = lady.barred.find((b) => b.grognardId === grognardId)
  if (existing) {
    return {
      ...lady,
      barred: lady.barred.map((b) =>
        b.grognardId === grognardId
          ? { ...b, court: b.court || !!change.court, propose: b.propose || !!change.propose }
          : b,
      ),
    }
  }
  return {
    ...lady,
    barred: [...lady.barred, { grognardId, court: !!change.court, propose: !!change.propose }],
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'GAME_CREATED':
      return { ...state, id: event.id, name: event.name, optionalRules: event.optionalRules }

    case 'PHASE_SET':
      return { ...state, campaignSeason: event.campaignSeason, phase: event.phase }

    case 'SENIOR_GROGNARD_SET':
      return { ...state, seniorGrognardId: event.grognardId }

    case 'SEATING_ORDER_SET':
      return { ...state, seatingOrder: [...event.order] }

    case 'OPTIONAL_RULES_SET':
      return { ...state, optionalRules: { ...event.rules } }

    case 'ABSENCE_RULES_SET':
      return { ...state, absenceRules: { ...event.rules } }

    case 'GAME_FLAG_SET':
      return { ...state, [event.flag]: event.value }

    case 'NOTE':
      return state

    // --- grognard ---------------------------------------------------------

    case 'GROGNARD_ADDED': {
      const g = { ...event.grognard, stats: clampStats(event.grognard.stats) }
      return {
        ...state,
        grognards: { ...state.grognards, [g.id]: g },
        seatingOrder: state.seatingOrder.includes(g.id)
          ? state.seatingOrder
          : [...state.seatingOrder, g.id],
      }
    }

    case 'GROGNARD_RENAMED':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        name: event.name,
        color: event.color,
      }))

    case 'STAT_DELTA':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        stats: addStats(g.stats, event.changes),
      }))

    case 'STAT_SET':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        stats: clampStats({ ...g.stats, ...event.changes }),
      }))

    case 'MONEY_DELTA':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        money: {
          paris: Math.max(0, g.money.paris + (event.changes.paris ?? 0)),
          purse: Math.max(0, g.money.purse + (event.changes.purse ?? 0)),
        },
      }))

    case 'MONEY_SET':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        money: {
          paris: Math.max(0, event.changes.paris ?? g.money.paris),
          purse: Math.max(0, event.changes.purse ?? g.money.purse),
        },
      }))

    case 'RANK_SET':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, rank: event.rankId }))

    case 'STANDING_SET':
      return withGrognard(state, event.grognardId, (g) =>
        // The hat counter freezes Standing: "No change in Standing from then."
        g.hasHatCounter ? g : { ...g, standingIndex: Math.max(0, event.index) },
      )

    case 'STANDING_DELTA':
      return withGrognard(state, event.grognardId, (g) =>
        g.hasHatCounter
          ? g
          : {
              ...g,
              standingIndex: Math.min(event.maxIndex, Math.max(0, g.standingIndex + event.delta)),
            },
      )

    case 'HAT_COUNTER_PLACED':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        hasHatCounter: true,
        standingIndex: event.index,
      }))

    case 'COMMAND_SET':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, commandId: event.commandId }))

    case 'LOH_LEVEL_DELTA':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        lohLevel: Math.min(event.maxLevel, Math.max(0, g.lohLevel + event.delta)),
      }))

    case 'TITLE_AWARDED':
      return withGrognard(state, event.grognardId, (g) =>
        // "A Grognard can have only 1 of each Title".
        g.titleIds.includes(event.titleId)
          ? g
          : { ...g, titleIds: [...g.titleIds, event.titleId] },
      )

    case 'TITLE_REMOVED':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        titleIds: g.titleIds.filter((id) => id !== event.titleId),
      }))

    case 'TITLES_CLEARED':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, titleIds: [] }))

    case 'OFFICE_SET':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, officeId: event.officeId }))

    case 'OFFICE_BARRED_FOR_LIFE':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        officeId: null,
        officeBarredForLife: true,
      }))

    case 'STATUS_SET':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        status: { ...g.status, ...event.changes },
      }))

    case 'CONVALESCENCE_SET':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        status: { ...g.status, convalescence: event.convalescence },
      }))

    case 'CONVALESCENCE_TICKED': {
      const grognards: Record<GrognardId, Grognard> = {}
      for (const [id, g] of Object.entries(state.grognards)) {
        grognards[id] = g.status.convalescence
          ? {
              ...g,
              status: {
                ...g.status,
                convalescence: {
                  ...g.status.convalescence,
                  fullRounds: g.status.convalescence.fullRounds + 1,
                },
              },
            }
          : g
      }
      return { ...state, grognards }
    }

    case 'WOUND_RECORDED':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        // Only non-duel wounds count towards the Imperial Guard request.
        woundsSinceDeath: g.woundsSinceDeath + (event.fromDuel ? 0 : 1),
      }))

    case 'INDISCRETION_SET':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        indiscretionThisCS: event.value,
      }))

    case 'BONAPARTIST_SET':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, bonapartist: event.value }))

    case 'CARD_DRAWN':
      return withGrognard(state, event.grognardId, (g) => ({
        ...g,
        cardsDrawnThisRound: g.cardsDrawnThisRound + 1,
      }))

    case 'ZEAL_USED':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, skipNextCard: true }))

    case 'SKIP_NEXT_CARD_CLEARED':
      return withGrognard(state, event.grognardId, (g) => ({ ...g, skipNextCard: false }))

    case 'ROUND_COUNTERS_RESET': {
      const grognards: Record<GrognardId, Grognard> = {}
      for (const [id, g] of Object.entries(state.grognards)) {
        grognards[id] = { ...g, cardsDrawnThisRound: 0, skipNextCard: false }
      }
      return { ...state, grognards }
    }

    // --- ladies -----------------------------------------------------------

    case 'LADY_ADDED':
      return { ...state, ladies: { ...state.ladies, [event.lady.id]: event.lady } }

    case 'LADY_REMOVED': {
      const ladies = { ...state.ladies }
      delete ladies[event.ladyId]
      return { ...state, ladies }
    }

    case 'LADY_QUALITIES_SET':
      return withLady(state, event.ladyId, (l) => ({ ...l, qualities: { ...event.qualities } }))

    case 'MARRIED':
      // "Remove Mistress counters from her. Remove Ardor markers from her."
      return withLady(state, event.ladyId, (l) => ({
        ...l,
        wifeOf: event.grognardId,
        mistressOf: [],
        ardor: [],
      }))

    case 'DIVORCED':
      // "May never Propose/Court this Lady" again.
      return withLady(state, event.ladyId, (l) =>
        setBarred({ ...l, wifeOf: null }, event.grognardId, { court: true, propose: true }),
      )

    case 'MISTRESS_TAKEN':
      return withLady(state, event.ladyId, (l) => ({
        ...l,
        mistressOf: l.mistressOf.includes(event.grognardId)
          ? l.mistressOf
          : [...l.mistressOf, event.grognardId],
      }))

    case 'MISTRESS_LOST':
      return withLady(state, event.ladyId, (l) => {
        const without = { ...l, mistressOf: l.mistressOf.filter((id) => id !== event.grognardId) }
        return event.barCourt ? setBarred(without, event.grognardId, { court: true }) : without
      })

    case 'ARDOR_ADDED':
      return withLady(state, event.ladyId, (l) => bumpArdor(l, event.grognardId, event.kind))

    case 'ARDOR_CLEARED':
      return withLady(state, event.ladyId, (l) => ({ ...l, ardor: [] }))

    // --- relations --------------------------------------------------------

    case 'INJURY_ADDED':
      return { ...state, injuries: [...state.injuries, event.injury] }

    case 'INJURIES_RESOLVED':
      return {
        ...state,
        injuries: state.injuries.map((i) =>
          event.injuryIds.includes(i.id) ? { ...i, resolved: true } : i,
        ),
      }

    case 'LOAN_MADE':
      return { ...state, loans: [...state.loans, event.loan] }

    case 'LOAN_REPAID':
      return {
        ...state,
        loans: state.loans.map((l) => (l.id === event.loanId ? { ...l, repaid: true } : l)),
      }
  }
}

/** Rebuilds state from a log. Used on load and after undo. */
export function foldEvents(initial: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce(applyEvent, initial)
}

/**
 * Wraps an event body with journal metadata for dispatch. The timestamp and id
 * are assigned here, at the boundary where the event enters the log — the
 * reducer above never generates either, which is what keeps `foldEvents`
 * reproducible.
 */
export function createEvent(
  body: GameEventBody,
  meta: { label: string; subjects?: GrognardId[]; rolls?: RollRecord[]; note?: string },
): GameEvent {
  return {
    id: newId('ev'),
    at: new Date().toISOString(),
    label: meta.label,
    subjects: meta.subjects ?? [],
    rolls: meta.rolls,
    note: meta.note,
    ...body,
  }
}
