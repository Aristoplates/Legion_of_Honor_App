/**
 * Character generation, Booklet Setup Section A "Grognard Sheet". Pure
 * lookups and formulas only — the wizard UI supplies the dice.
 */
import { lookupAssignment, assignmentTableFor } from '../../data/lookups'
import type { GameData } from '../../data/schema'
import type { CommandId, RankId } from '../types'

/** Booklet formulas, in the order the Grognard Sheet lists them. */
export const SETUP_FORMULAS = {
  assignment: '2D10',
  rank: '1D10',
  notice: '1D10÷4▼',
  glory: '1D10',
  experience: '1D10÷2▲',
  moneyParis: '2D10÷4▼',
  moneyPurse: '1D10',
  health: '1D10',
  charm: '1D10',
  fencing: '1D10÷3▲',
} as const

export type SetupStat = keyof typeof SETUP_FORMULAS

/**
 * "[1..5] = Sergent, [6..10] = Sous-Lieutenant box." These two rank ids are
 * fixed by the booklet itself, unlike every other rank id which only exists
 * in ranks.json.
 */
export function startingRankId(rankRoll: number): RankId {
  return rankRoll <= 5 ? 'sergent' : 'sous-lieutenant'
}

/** "Health: 100 – 1D10." */
export function startingHealth(rollValue: number): number {
  return 100 - rollValue
}

/** 2D10 on the Assignment Sheet (CS I, main table — Setup never uses Spain). */
export function startingAssignment(data: GameData, assignmentRoll: number): CommandId | undefined {
  return lookupAssignment(data, 1, false, assignmentRoll)?.commandId
}

export function hasAssignmentTable(data: GameData): boolean {
  return (assignmentTableFor(data, 1, false)?.length ?? 0) > 0
}
