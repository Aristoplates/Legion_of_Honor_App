/**
 * Lookups into the game data tables.
 *
 * Two flavours throughout: a `find…` that returns undefined, and a `must…`
 * that throws naming the table and key. The tables are typed in by hand from
 * the printed play aids, so a loud error beats a silently wrong Grognard.
 */
import { findByRange } from '../domain/rng'
import type {
  AssignmentEntry,
  CampaignSeasonDef,
  CommandDef,
  GameData,
  LadyQualityRow,
  LegionOfHonorLevel,
  OfficeDef,
  RankDef,
  StandingBox,
  TitleDef,
  WoundEntry,
  WoundLevel,
} from './schema'

export class MissingGameDataError extends Error {
  constructor(what: string) {
    super(`${what}. Fill in the matching table under src/data — see the Tables screen.`)
    this.name = 'MissingGameDataError'
  }
}

// --- ranks -----------------------------------------------------------------

export function findRank(data: GameData, id: string): RankDef | undefined {
  return data.ranks.find((r) => r.id === id)
}

export function mustRank(data: GameData, id: string): RankDef {
  const rank = findRank(data, id)
  if (!rank) throw new MissingGameDataError(`Rank "${id}" is not in ranks.json`)
  return rank
}

/** The ladder, lowest first. */
export function ranksInOrder(data: GameData): RankDef[] {
  return [...data.ranks].sort((a, b) => a.order - b.order)
}

export function rankByOrder(data: GameData, order: number): RankDef | undefined {
  return data.ranks.find((r) => r.order === order)
}

/**
 * The next rank up. Uses "lowest order above the current one" rather than
 * order + 1, so intermediate ranks can be inserted into ranks.json later
 * without renumbering the whole ladder.
 */
export function nextRank(data: GameData, current: RankDef): RankDef | undefined {
  return ranksInOrder(data).find((r) => r.order > current.order)
}

// --- commands --------------------------------------------------------------

export function findCommand(data: GameData, id: string | null): CommandDef | undefined {
  if (id === null) return undefined
  return data.commands.find((c) => c.id === id)
}

export function mustCommand(data: GameData, id: string): CommandDef {
  const command = findCommand(data, id)
  if (!command) throw new MissingGameDataError(`Command "${id}" is not in commands.json`)
  return command
}

export function armyStaffCommand(data: GameData): CommandDef | undefined {
  return data.commands.find((c) => c.isArmyStaff)
}

// --- assignment ------------------------------------------------------------

/**
 * The Assignment Sheet table to use: the Spain table when asked for, otherwise
 * the season's own table, otherwise the default one.
 */
export function assignmentTableFor(
  data: GameData,
  campaignSeason: number,
  spain: boolean,
): AssignmentEntry[] | undefined {
  const id = spain
    ? data.spainAssignmentTableId
    : (findCampaignSeason(data, campaignSeason)?.assignmentTableId ??
      data.defaultAssignmentTableId)
  if (!id) return undefined
  const table = data.assignmentTables.find((t) => t.id === id)
  return table && table.entries.length > 0 ? table.entries : undefined
}

/** 2D10 (1..100) → Command, or undefined when the table is not filled in yet. */
export function lookupAssignment(
  data: GameData,
  campaignSeason: number,
  spain: boolean,
  roll: number,
): AssignmentEntry | undefined {
  const entries = assignmentTableFor(data, campaignSeason, spain)
  return entries ? findByRange(entries, roll) : undefined
}

// --- standing --------------------------------------------------------------

export function findStandingBox(data: GameData, index: number): StandingBox | undefined {
  return data.standing.boxes.find((b) => b.index === index)
}

export function mustStandingBox(data: GameData, index: number): StandingBox {
  const box = findStandingBox(data, index)
  if (!box) throw new MissingGameDataError(`Standing box ${index} is not in standing.json`)
  return box
}

export function maxStandingIndex(data: GameData): number {
  return data.standing.boxes.reduce((max, b) => Math.max(max, b.index), 0)
}

/** "Roll 1D10 on Standing" → the new box index. */
export function standingIndexForRoll(data: GameData, roll: number): number | undefined {
  return findByRange(data.standing.rollToIndex, roll)?.index
}

// --- wounds ----------------------------------------------------------------

export function findWoundLevel(data: GameData, id: string): WoundLevel | undefined {
  return data.wounds.levels.find((l) => l.id === id)
}

export function mustWoundLevel(data: GameData, id: string): WoundLevel {
  const level = findWoundLevel(data, id)
  if (!level) throw new MissingGameDataError(`Wound level "${id}" is not in wounds.json`)
  return level
}

/** 2D10 on the Wound Table, +10 when the duel card was played "To Wound". */
export function lookupWound(data: GameData, roll: number): WoundEntry | undefined {
  return findByRange(data.wounds.entries, roll)
}

/** One step less severe, for the "Save Comrade" heroic act. */
export function reduceWoundLevel(data: GameData, id: string): WoundLevel | undefined {
  const current = mustWoundLevel(data, id)
  const milder = data.wounds.levels
    .filter((l) => l.severity < current.severity)
    .sort((a, b) => b.severity - a.severity)
  return milder[0]
}

// --- Legion of Honor, titles, offices -------------------------------------

export function findLohLevel(data: GameData, level: number): LegionOfHonorLevel | undefined {
  return data.legionOfHonor.find((l) => l.level === level)
}

export function maxLohLevel(data: GameData): number {
  return data.legionOfHonor.reduce((max, l) => Math.max(max, l.level), 0)
}

export function findTitle(data: GameData, id: string): TitleDef | undefined {
  return data.titles.find((t) => t.id === id)
}

export function mustTitle(data: GameData, id: string): TitleDef {
  const title = findTitle(data, id)
  if (!title) throw new MissingGameDataError(`Title "${id}" is not in titles.json`)
  return title
}

export function findOffice(data: GameData, id: string | null): OfficeDef | undefined {
  if (id === null) return undefined
  return data.offices.find((o) => o.id === id)
}

// --- campaign seasons ------------------------------------------------------

export function findCampaignSeason(data: GameData, number: number): CampaignSeasonDef | undefined {
  return data.campaignSeasons.find((cs) => cs.number === number)
}

export function mustCampaignSeason(data: GameData, number: number): CampaignSeasonDef {
  const cs = findCampaignSeason(data, number)
  if (!cs) throw new MissingGameDataError(`Campaign Season ${number} is not in campaignSeasons.json`)
  return cs
}

// --- ladies ----------------------------------------------------------------

/** Lady Quality Table: 1D10 → how many boxes each quality marker moves. */
export function lookupLadyQuality(data: GameData, roll: number): LadyQualityRow | undefined {
  return findByRange(data.ladyQualityTable, roll)
}
