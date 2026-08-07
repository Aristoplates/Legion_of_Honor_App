/**
 * Schemas for the game data tables (the printed play aids).
 *
 * Everything the rules need to look up lives in JSON next to this file and is
 * validated on startup, so a typo in a table is a loud error instead of a
 * silently wrong Grognard. Values still missing are represented by empty
 * arrays — the rules fall back to asking the player instead of blocking.
 */
import { z } from 'zod'

const Int = z.number().int()
const NonNeg = Int.min(0)

/** A 1..100 range as produced by a 2D10 percentile roll, or 1..10 for 1D10. */
export const RangeSchema = z
  .object({
    min: Int,
    max: Int,
  })
  .refine((r) => r.min <= r.max, { message: 'min must not exceed max' })

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

/**
 * Play aid: "Transfer Approved if Result…" — the test differs per rank band.
 *  - aboveStandingCheck:  Result > (S)
 *  - belowNoticeFraction: Result < N ÷ divisor ▼
 *  - forbidden:           General..Marechal cannot request a transfer
 */
export const TransferRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('aboveStandingCheck') }),
  z.object({ kind: z.literal('belowNoticeFraction'), divisor: Int.min(1) }),
  z.object({ kind: z.literal('forbidden') }),
])

/**
 * Booklet Segment Step 4: "Check Reassignment".
 *  - atLeastStandingCheck: 1D10 ≥ (S) → reassigned   [Sergent..Major]
 *  - atMost:               1D10 ≤ 3   → reassigned   [Colonel..Marechal]
 */
export const ReassignmentRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('atLeastStandingCheck') }),
  z.object({ kind: z.literal('atMost'), value: Int }),
])

export const RankSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Position on the ladder, 0 = lowest. Must be unique and gap-free. */
  order: NonNeg,
  /** Minimum N/G/E to be promoted into this rank. N is only enforced from CS VI. */
  requirements: z.object({ n: NonNeg, g: NonNeg, e: NonNeg }),
  /** Income per round, before the Imperial Guard / Absent modifiers. */
  income: NonNeg,
  /** General or Marechal: only one per Command, and Standing is frozen. */
  isSeniorCommanderRank: z.boolean().default(false),
  /** General or Marechal: the "hat" counter replaces the Standing counter. */
  freezesStanding: z.boolean().default(false),
  /** Duels require both parties in [Sergent..Colonel]. */
  canDuel: z.boolean().default(true),
  transfer: TransferRuleSchema,
  reassignment: ReassignmentRuleSchema,
})

// ---------------------------------------------------------------------------
// Commands / Assignment
// ---------------------------------------------------------------------------

export const TheaterSchema = z.enum(['main', 'orient', 'spain'])

export const CommandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** "We Were There!" only applies within the same theater. */
  theater: TheaterSchema.default('main'),
  isImperialGuard: z.boolean().default(false),
  /** Army Staff: +2 G / +2 E on every card any Grognard draws. */
  isArmyStaff: z.boolean().default(false),
  /** Army Staff has no Senior Commander slot. */
  allowsSeniorCommander: z.boolean().default(true),
})

export const AssignmentEntrySchema = z.object({
  range: RangeSchema,
  commandId: z.string().min(1),
  /** Free-text note from the Assignment Sheet, shown to the player verbatim. */
  note: z.string().optional(),
})

export const AssignmentTableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 2D10 (1..100) → Command. */
  entries: z.array(AssignmentEntrySchema),
})

// ---------------------------------------------------------------------------
// Standing
// ---------------------------------------------------------------------------

export const StandingBoxSchema = z.object({
  /** 0-based index along the printed track. */
  index: NonNeg,
  /** As printed, e.g. "+0 (5)". */
  label: z.string().min(1),
  /** The parenthesised number — the "(S)" used in transfer/reassignment tests. */
  checkValue: Int,
  /**
   * The signed value printed before the parenthesis (+5..-4). Battle Event
   * applies it additively to a Combat card's N and G — "increase N & G by
   * positive S (but no more than double the original increase); reduce N & G
   * by negative S (but no less than 0)" (Rules Summary Sheet, "Standing
   * Effect on N & G"): clamp(cardValue + standingModifier, 0, cardValue * 2).
   */
  standingModifier: Int,
})

export const StandingTableSchema = z.object({
  boxes: z.array(StandingBoxSchema),
  /** The box a freshly created or reassigned Grognard starts in ("0 (5)"). */
  defaultIndex: NonNeg,
  /** 1D10 → box index, used by "Roll 1D10 on Standing". */
  rollToIndex: z.array(z.object({ range: RangeSchema, index: NonNeg })),
})

// ---------------------------------------------------------------------------
// Wounds
// ---------------------------------------------------------------------------

export const WoundLevelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Higher = worse. KIA is the highest. Drives "Badly Wounded or worse". */
  severity: NonNeg,
  /** Recovery bonus per full round in convalescence (Gravely 3, Severely 5, Badly 8). */
  recoveryMultiplier: Int.min(0).nullable(),
  causesConvalescence: z.boolean(),
  isKia: z.boolean().default(false),
})

export const WoundEntrySchema = z.object({
  /** 2D10 (1..100), +10 when the duel card was played "To Wound". */
  range: RangeSchema,
  levelId: z.string().min(1),
  /** Health lost, as a plain number or dice notation such as "1d10". */
  health: z.union([Int, z.string().min(1)]),
  /** Duels ignore these three (play aid: "Ignore S, G, E from Wound Table"). */
  glory: Int.default(0),
  experience: Int.default(0),
  standingDelta: Int.default(0),
})

export const WoundTableSchema = z.object({
  levels: z.array(WoundLevelSchema),
  entries: z.array(WoundEntrySchema),
})

// ---------------------------------------------------------------------------
// Legion of Honor / Titles / Offices
// ---------------------------------------------------------------------------

export const LegionOfHonorLevelSchema = z.object({
  level: NonNeg,
  name: z.string().min(1),
  /** Both only apply once the marker is face up (after InG VI-4). */
  income: NonNeg.default(0),
  glory: NonNeg.default(0),
})

export const TitleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Income per round. Marechal is excluded from income ("other than Marechal"). */
  income: NonNeg.default(0),
  countsForIncome: z.boolean().default(true),
  /** Court/Propose attractiveness bonus: Comte 5, Duc 10, Prince 15. */
  attractiveness: NonNeg.default(0),
  /** Minimum rank order required to be awarded the title. */
  minRankOrder: NonNeg.optional(),
  /** Prince additionally requires the Duc title. */
  requiresTitleIds: z.array(z.string()).default([]),
  /** Combat cards that can award it, by card title. */
  awardedByCards: z.array(z.string()).default([]),
})

export const OfficeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  income: NonNeg.default(0),
})

// ---------------------------------------------------------------------------
// Campaign Seasons
// ---------------------------------------------------------------------------

export const CampaignSeasonSchema = z.object({
  /** 1..16 */
  number: Int.min(1),
  roman: z.string().min(1),
  name: z.string().min(1),
  /** null = not transcribed from the Campaign Season Sheet yet; the app asks. */
  inGarrisonRounds: NonNeg.nullable(),
  onCampaignRounds: NonNeg.nullable(),
  /** Card identifiers as printed, e.g. ["III-1", "III-2"]. Reference only. */
  inGarrisonEventCards: z.array(z.string()).default([]),
  onCampaignEventCards: z.array(z.string()).default([]),
  /** Assignment table to use; falls back to the default table when absent. */
  assignmentTableId: z.string().optional(),
  flags: z
    .object({
      /** CS XV has no Prisoner Exchange. */
      noPrisonerExchange: z.boolean().default(false),
      /** CS X and XII: the two Portugal battle rounds. */
      spainBattleRounds: z.boolean().default(false),
      /** Only one Senior Commander in this army during this CS. */
      forcedSeniorCommanderCommandId: z.string().optional(),
    })
    .default(() => ({ noPrisonerExchange: false, spainBattleRounds: false })),
})

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const LadyQualityRowSchema = z.object({
  /** 1D10 range. */
  range: RangeSchema,
  charm: Int,
  influence: Int,
  money: Int,
})

/** Lady Charm / Influence / Money tracks: box index → value used in the rules. */
export const LadyTrackSchema = z.object({
  min: Int,
  max: Int,
  /** Where a newly met Lady's markers start. */
  defaultValue: Int,
})

export const GameDataSchema = z.object({
  ranks: z.array(RankSchema),
  commands: z.array(CommandSchema),
  assignmentTables: z.array(AssignmentTableSchema),
  defaultAssignmentTableId: z.string().optional(),
  spainAssignmentTableId: z.string().optional(),
  standing: StandingTableSchema,
  wounds: WoundTableSchema,
  legionOfHonor: z.array(LegionOfHonorLevelSchema),
  titles: z.array(TitleSchema),
  offices: z.array(OfficeSchema),
  campaignSeasons: z.array(CampaignSeasonSchema),
  ladyQualityTable: z.array(LadyQualityRowSchema),
  ladyTracks: z.object({
    charm: LadyTrackSchema,
    influence: LadyTrackSchema,
    money: LadyTrackSchema,
  }),
})

export type Range = z.infer<typeof RangeSchema>
export type TransferRule = z.infer<typeof TransferRuleSchema>
export type ReassignmentRule = z.infer<typeof ReassignmentRuleSchema>
export type RankDef = z.infer<typeof RankSchema>
export type Theater = z.infer<typeof TheaterSchema>
export type CommandDef = z.infer<typeof CommandSchema>
export type AssignmentEntry = z.infer<typeof AssignmentEntrySchema>
export type AssignmentTable = z.infer<typeof AssignmentTableSchema>
export type StandingBox = z.infer<typeof StandingBoxSchema>
export type StandingTable = z.infer<typeof StandingTableSchema>
export type WoundLevel = z.infer<typeof WoundLevelSchema>
export type WoundEntry = z.infer<typeof WoundEntrySchema>
export type WoundTable = z.infer<typeof WoundTableSchema>
export type LegionOfHonorLevel = z.infer<typeof LegionOfHonorLevelSchema>
export type TitleDef = z.infer<typeof TitleSchema>
export type OfficeDef = z.infer<typeof OfficeSchema>
export type CampaignSeasonDef = z.infer<typeof CampaignSeasonSchema>
export type LadyQualityRow = z.infer<typeof LadyQualityRowSchema>
export type LadyTrack = z.infer<typeof LadyTrackSchema>
export type GameData = z.infer<typeof GameDataSchema>
