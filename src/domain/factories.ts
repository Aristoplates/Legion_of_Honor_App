/**
 * Constructors for the mutable entities. Kept out of events.ts so the reducer
 * stays free of defaults, and out of the UI so tests build the same objects the
 * app does.
 */
import type { Grognard, GrognardId, Injury, InjuryReason, Lady, LadyId, Loan, Stats } from './types'

/** Counter colours, distinct enough to tell apart on a phone screen. */
export const GROGNARD_COLORS = [
  '#c0453f', // red
  '#2f4a7a', // blue
  '#4a7a4f', // green
  '#c8a24a', // gold
  '#7a4a7a', // violet
  '#3f8f96', // teal
] as const

let counter = 0

/**
 * Ids only need to be unique within one save file. A counter plus a random
 * suffix avoids a clash when two saves are merged via export/import.
 */
export function newId(prefix: string): string {
  counter += 1
  const suffix = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0')
  return `${prefix}_${counter.toString(36)}${suffix}`
}

export interface NewGrognardInput {
  name: string
  color?: string
  rank: string
  stats: Stats
  money: { paris: number; purse: number }
  standingIndex: number
  commandId?: string | null
}

export function createGrognard(input: NewGrognardInput): Grognard {
  return {
    id: newId('g'),
    name: input.name,
    color: input.color ?? GROGNARD_COLORS[0],
    rank: input.rank,
    stats: { ...input.stats },
    money: { ...input.money },
    standingIndex: input.standingIndex,
    hasHatCounter: false,
    commandId: input.commandId ?? null,
    lohLevel: 0,
    titleIds: [],
    officeId: null,
    officeBarredForLife: false,
    status: {
      dead: false,
      prisoner: false,
      retired: false,
      furlough: false,
      convalescence: null,
    },
    woundsSinceDeath: 0,
    indiscretionThisCS: false,
    bonapartist: false,
    cardsDrawnThisRound: 0,
    skipNextCard: false,
  }
}

export function createLady(name: string, qualities: Lady['qualities']): Lady {
  return {
    id: newId('l'),
    name,
    qualities: { ...qualities },
    wifeOf: null,
    mistressOf: [],
    ardor: [],
    barred: [],
  }
}

export function createInjury(
  victimId: GrognardId,
  offenderId: GrognardId,
  reason: InjuryReason,
  campaignSeason: number,
): Injury {
  return { id: newId('inj'), victimId, offenderId, reason, campaignSeason, resolved: false }
}

export function createLoan(
  lenderId: GrognardId,
  borrowerId: GrognardId,
  amount: number,
  terms: string,
  campaignSeason: number,
): Loan {
  return { id: newId('loan'), lenderId, borrowerId, amount, terms, campaignSeason, repaid: false }
}

export function createLadyId(): LadyId {
  return newId('l')
}
