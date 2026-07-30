/**
 * Loads and validates the game data tables.
 *
 * The JSON files are bundled at build time, so validation runs once at startup
 * and a malformed table is a loud error rather than a wrong Grognard. Tables
 * that are merely *incomplete* are legal — {@link dataGaps} reports them so the
 * Tables screen can say what is missing and the rules can fall back to asking.
 */
import { GameDataSchema, type GameData } from './schema'
import assignments from './assignments.json'
import campaignSeasons from './campaignSeasons.json'
import commands from './commands.json'
import honors from './honors.json'
import ladies from './ladies.json'
import ranks from './ranks.json'
import standing from './standing.json'
import wounds from './wounds.json'

/** Thrown when a data file does not match the schema. Not recoverable. */
export class GameDataError extends Error {
  constructor(readonly issues: string[]) {
    super(`Game data is invalid:\n${issues.join('\n')}`)
    this.name = 'GameDataError'
  }
}

function assemble(): unknown {
  return {
    ranks: ranks.ranks,
    commands: commands.commands,
    assignmentTables: assignments.assignmentTables,
    defaultAssignmentTableId: assignments.defaultAssignmentTableId,
    spainAssignmentTableId: assignments.spainAssignmentTableId,
    standing: standing.standing,
    wounds: wounds.wounds,
    legionOfHonor: honors.legionOfHonor,
    titles: honors.titles,
    offices: honors.offices,
    campaignSeasons: campaignSeasons.campaignSeasons,
    ladyQualityTable: ladies.ladyQualityTable,
    ladyTracks: ladies.ladyTracks,
  }
}

let cached: GameData | undefined

export function loadGameData(): GameData {
  if (cached) return cached

  const result = GameDataSchema.safeParse(assemble())
  if (!result.success) {
    throw new GameDataError(
      result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`),
    )
  }

  const data = result.data
  const structural = structuralIssues(data)
  if (structural.length > 0) throw new GameDataError(structural)

  cached = data
  return data
}

/**
 * Consistency checks a per-field schema cannot express: duplicate ids, ranges
 * that overlap, references to ids that do not exist.
 */
function structuralIssues(data: GameData): string[] {
  const issues: string[] = []

  const duplicates = (label: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) issues.push(`  ${label}: duplicate id "${id}"`)
      seen.add(id)
    }
  }
  duplicates('ranks', data.ranks.map((r) => r.id))
  duplicates('commands', data.commands.map((c) => c.id))
  duplicates('titles', data.titles.map((t) => t.id))
  duplicates('offices', data.offices.map((o) => o.id))
  duplicates('wounds.levels', data.wounds.levels.map((l) => l.id))
  duplicates('assignmentTables', data.assignmentTables.map((t) => t.id))

  const rankOrders = data.ranks.map((r) => r.order)
  if (new Set(rankOrders).size !== rankOrders.length) {
    issues.push('  ranks: two ranks share the same "order"')
  }

  const commandIds = new Set(data.commands.map((c) => c.id))
  for (const table of data.assignmentTables) {
    for (const entry of table.entries) {
      if (!commandIds.has(entry.commandId)) {
        issues.push(
          `  assignmentTables.${table.id}: entry ${entry.range.min}-${entry.range.max} points at unknown Command "${entry.commandId}"`,
        )
      }
    }
    issues.push(...overlaps(`assignmentTables.${table.id}`, table.entries))
  }

  const woundLevelIds = new Set(data.wounds.levels.map((l) => l.id))
  for (const entry of data.wounds.entries) {
    if (!woundLevelIds.has(entry.levelId)) {
      issues.push(
        `  wounds.entries: ${entry.range.min}-${entry.range.max} points at unknown level "${entry.levelId}"`,
      )
    }
  }
  issues.push(...overlaps('wounds.entries', data.wounds.entries))
  issues.push(...overlaps('ladyQualityTable', data.ladyQualityTable))
  issues.push(...overlaps('standing.rollToIndex', data.standing.rollToIndex))

  const titleIds = new Set(data.titles.map((t) => t.id))
  for (const title of data.titles) {
    for (const required of title.requiresTitleIds) {
      if (!titleIds.has(required)) {
        issues.push(`  titles.${title.id}: requires unknown title "${required}"`)
      }
    }
  }

  const boxIndexes = new Set(data.standing.boxes.map((b) => b.index))
  if (data.standing.boxes.length > 0 && !boxIndexes.has(data.standing.defaultIndex)) {
    issues.push(`  standing: defaultIndex ${data.standing.defaultIndex} is not one of the boxes`)
  }
  for (const mapping of data.standing.rollToIndex) {
    if (!boxIndexes.has(mapping.index)) {
      issues.push(`  standing.rollToIndex: box ${mapping.index} does not exist`)
    }
  }

  const seasonNumbers = data.campaignSeasons.map((cs) => cs.number)
  if (new Set(seasonNumbers).size !== seasonNumbers.length) {
    issues.push('  campaignSeasons: duplicate season number')
  }
  for (const cs of data.campaignSeasons) {
    const id = cs.flags.forcedSeniorCommanderCommandId
    if (id !== undefined && !commandIds.has(id)) {
      issues.push(`  campaignSeasons.${cs.roman}: unknown Command "${id}"`)
    }
    if (cs.assignmentTableId && !data.assignmentTables.some((t) => t.id === cs.assignmentTableId)) {
      issues.push(`  campaignSeasons.${cs.roman}: unknown assignment table "${cs.assignmentTableId}"`)
    }
  }

  return issues
}

function overlaps(
  label: string,
  entries: ReadonlyArray<{ range: { min: number; max: number } }>,
): string[] {
  const sorted = [...entries].sort((a, b) => a.range.min - b.range.min)
  const issues: string[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!
    const current = sorted[i]!
    if (current.range.min <= previous.range.max) {
      issues.push(
        `  ${label}: ranges ${previous.range.min}-${previous.range.max} and ${current.range.min}-${current.range.max} overlap`,
      )
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

export interface DataGap {
  table: string
  /** What is missing. */
  what: string
  /** What the app cannot do until it is filled in. */
  impact: string
}

/**
 * Which tables are still to be transcribed from the printed play aids. The app
 * works without them — every gap has a fallback that asks the player — so this
 * is a checklist, not an error.
 */
export function dataGaps(data: GameData): DataGap[] {
  const gaps: DataGap[] = []

  if (data.ranks.every((r) => r.income === 0)) {
    gaps.push({
      table: 'ranks.json',
      what: 'Income per rank',
      impact: 'Income steps compute 0 for rank pay',
    })
  }
  if (data.ranks.every((r) => r.requirements.n + r.requirements.g + r.requirements.e === 0)) {
    gaps.push({
      table: 'ranks.json',
      what: 'N/G/E requirements per rank',
      impact: 'Promotion cannot be checked; every rank looks reachable',
    })
  }
  if (data.ranks.length < 9) {
    gaps.push({
      table: 'ranks.json',
      what: 'Ranks between Sous-Lieutenant and Major',
      impact: 'Promotion skips the missing ranks',
    })
  }

  for (const table of data.assignmentTables) {
    if (table.entries.length === 0) {
      gaps.push({
        table: 'assignments.json',
        what: `2D10 table "${table.name}"`,
        impact: 'Assignment asks which Command a roll gives',
      })
    }
  }

  if (data.standing.boxes.length <= 1) {
    gaps.push({
      table: 'standing.json',
      what: 'The Standing track boxes',
      impact: 'Standing cannot move; transfer and reassignment tests need (S)',
    })
  }
  if (data.standing.rollToIndex.length === 0) {
    gaps.push({
      table: 'standing.json',
      what: '1D10 to Standing box mapping',
      impact: '"Roll 1D10 on Standing" asks for the resulting box',
    })
  }

  if (data.wounds.entries.length === 0) {
    gaps.push({
      table: 'wounds.json',
      what: 'The Wound Table (2D10)',
      impact: 'Wounds and duel results have to be entered by hand',
    })
  }

  if (data.legionOfHonor.length <= 1) {
    gaps.push({
      table: 'honors.json',
      what: 'Legion of Honor track levels',
      impact: 'The LoH check cannot raise a level',
    })
  }
  if (data.titles.every((t) => t.income === 0)) {
    gaps.push({
      table: 'honors.json',
      what: 'Income per title',
      impact: 'Income steps compute 0 for titles',
    })
  }
  if (data.offices.length === 0) {
    gaps.push({
      table: 'honors.json',
      what: 'The list of Offices',
      impact: 'Seek Office has nothing to grant',
    })
  }

  const unknownRounds = data.campaignSeasons.filter(
    (cs) => cs.inGarrisonRounds === null || cs.onCampaignRounds === null,
  )
  if (unknownRounds.length > 0) {
    gaps.push({
      table: 'campaignSeasons.json',
      what: `Round counts for ${unknownRounds.length} of ${data.campaignSeasons.length} seasons`,
      impact: 'The app asks how many rounds a season has',
    })
  }

  return gaps
}
