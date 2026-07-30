/**
 * Fixture data for the domain tests.
 *
 * Deliberately *not* the real play-aid values (those are still to be
 * transcribed): small, made-up tables with round numbers, so a failing test
 * points at the rule and not at arithmetic in the data.
 */
import type { GameData } from '../src/data/schema'
import { emptyState } from '../src/domain/events'
import { createGrognard, createLady } from '../src/domain/factories'
import type { GameState, Grognard, Stats } from '../src/domain/types'

export const TEST_STATS: Stats = { n: 20, g: 30, e: 10, h: 80, c: 5, f: 4 }

export const testData: GameData = {
  ranks: [
    {
      id: 'sergent',
      name: 'Sergent',
      order: 0,
      requirements: { n: 0, g: 0, e: 0 },
      income: 10,
      isSeniorCommanderRank: false,
      freezesStanding: false,
      canDuel: true,
      transfer: { kind: 'aboveStandingCheck' },
      reassignment: { kind: 'atLeastStandingCheck' },
    },
    {
      id: 'sous-lieutenant',
      name: 'Sous-Lieutenant',
      order: 1,
      requirements: { n: 10, g: 20, e: 5 },
      income: 20,
      isSeniorCommanderRank: false,
      freezesStanding: false,
      canDuel: true,
      transfer: { kind: 'aboveStandingCheck' },
      reassignment: { kind: 'atLeastStandingCheck' },
    },
    {
      id: 'colonel',
      name: 'Colonel',
      order: 2,
      requirements: { n: 40, g: 100, e: 40 },
      income: 61,
      isSeniorCommanderRank: false,
      freezesStanding: false,
      canDuel: true,
      transfer: { kind: 'belowNoticeFraction', divisor: 15 },
      reassignment: { kind: 'atMost', value: 3 },
    },
    {
      id: 'general',
      name: 'General',
      order: 3,
      requirements: { n: 60, g: 200, e: 80 },
      income: 100,
      isSeniorCommanderRank: true,
      freezesStanding: true,
      canDuel: false,
      transfer: { kind: 'forbidden' },
      reassignment: { kind: 'atMost', value: 3 },
    },
    {
      id: 'marechal',
      name: 'Marechal',
      order: 4,
      requirements: { n: 80, g: 400, e: 120 },
      income: 200,
      isSeniorCommanderRank: true,
      freezesStanding: true,
      canDuel: false,
      transfer: { kind: 'forbidden' },
      reassignment: { kind: 'atMost', value: 3 },
    },
  ],
  commands: [
    {
      id: 'staff',
      name: 'Army Staff',
      theater: 'main',
      isImperialGuard: false,
      isArmyStaff: true,
      allowsSeniorCommander: false,
    },
    {
      id: 'i-corps',
      name: 'I Corps',
      theater: 'main',
      isImperialGuard: false,
      isArmyStaff: false,
      allowsSeniorCommander: true,
    },
    {
      id: 'ii-corps',
      name: 'II Corps',
      theater: 'main',
      isImperialGuard: false,
      isArmyStaff: false,
      allowsSeniorCommander: true,
    },
    {
      id: 'imperial-guard',
      name: 'Imperial Guard',
      theater: 'main',
      isImperialGuard: true,
      isArmyStaff: false,
      allowsSeniorCommander: true,
    },
    {
      id: 'spain-army',
      name: 'Army of Spain',
      theater: 'spain',
      isImperialGuard: false,
      isArmyStaff: false,
      allowsSeniorCommander: true,
    },
  ],
  assignmentTables: [
    {
      id: 'default',
      name: 'Assignment (test)',
      entries: [
        { range: { min: 1, max: 50 }, commandId: 'i-corps' },
        { range: { min: 51, max: 90 }, commandId: 'ii-corps' },
        { range: { min: 91, max: 100 }, commandId: 'staff', note: 'Army Staff' },
      ],
    },
    {
      id: 'spain',
      name: 'Assignment — Spain (test)',
      entries: [{ range: { min: 1, max: 100 }, commandId: 'spain-army' }],
    },
  ],
  defaultAssignmentTableId: 'default',
  spainAssignmentTableId: 'spain',
  standing: {
    // Five boxes: check value falls as Standing improves, so a lower (S) is better.
    boxes: [
      { index: 0, label: '-2 (8)', checkValue: 8, battleMultiplier: 0.5 },
      { index: 1, label: '-1 (7)', checkValue: 7, battleMultiplier: 0.75 },
      { index: 2, label: '+0 (5)', checkValue: 5, battleMultiplier: 1 },
      { index: 3, label: '+1 (3)', checkValue: 3, battleMultiplier: 1.25 },
      { index: 4, label: '+2 (2)', checkValue: 2, battleMultiplier: 1.5 },
    ],
    defaultIndex: 2,
    rollToIndex: [
      { range: { min: 1, max: 2 }, index: 0 },
      { range: { min: 3, max: 4 }, index: 1 },
      { range: { min: 5, max: 6 }, index: 2 },
      { range: { min: 7, max: 8 }, index: 3 },
      { range: { min: 9, max: 10 }, index: 4 },
    ],
  },
  wounds: {
    levels: [
      {
        id: 'slightly',
        name: 'Slightly Wounded',
        severity: 1,
        recoveryMultiplier: null,
        causesConvalescence: false,
        isKia: false,
      },
      {
        id: 'badly',
        name: 'Badly Wounded',
        severity: 2,
        recoveryMultiplier: 8,
        causesConvalescence: true,
        isKia: false,
      },
      {
        id: 'severely',
        name: 'Severely Wounded',
        severity: 3,
        recoveryMultiplier: 5,
        causesConvalescence: true,
        isKia: false,
      },
      {
        id: 'gravely',
        name: 'Gravely Wounded',
        severity: 4,
        recoveryMultiplier: 3,
        causesConvalescence: true,
        isKia: false,
      },
      {
        id: 'kia',
        name: 'Killed in Action',
        severity: 5,
        recoveryMultiplier: null,
        causesConvalescence: false,
        isKia: true,
      },
    ],
    entries: [
      { range: { min: 1, max: 40 }, levelId: 'slightly', health: 5, glory: 1, experience: 0, standingDelta: 0 },
      { range: { min: 41, max: 70 }, levelId: 'badly', health: 10, glory: 2, experience: 1, standingDelta: 0 },
      { range: { min: 71, max: 85 }, levelId: 'severely', health: 20, glory: 3, experience: 1, standingDelta: 0 },
      { range: { min: 86, max: 95 }, levelId: 'gravely', health: 30, glory: 4, experience: 2, standingDelta: 0 },
      { range: { min: 96, max: 110 }, levelId: 'kia', health: 100, glory: 5, experience: 0, standingDelta: 0 },
    ],
  },
  legionOfHonor: [
    { level: 0, name: 'None', income: 0, glory: 0 },
    { level: 1, name: 'Legionnaire', income: 25, glory: 1 },
    { level: 2, name: 'Officier', income: 50, glory: 2 },
    { level: 3, name: 'Commandant', income: 100, glory: 3 },
  ],
  titles: [
    {
      id: 'comte',
      name: 'Comte',
      income: 50,
      countsForIncome: true,
      attractiveness: 5,
      minRankOrder: 2,
      requiresTitleIds: [],
      awardedByCards: ['Carry the Day'],
    },
    {
      id: 'duc',
      name: 'Duc',
      income: 100,
      countsForIncome: true,
      attractiveness: 10,
      minRankOrder: 3,
      requiresTitleIds: [],
      awardedByCards: ['Carry the Day'],
    },
    {
      id: 'prince',
      name: 'Prince',
      income: 200,
      countsForIncome: true,
      attractiveness: 15,
      minRankOrder: 4,
      requiresTitleIds: ['duc'],
      awardedByCards: ['Carry the Day'],
    },
    {
      id: 'marechal',
      name: 'Marechal',
      income: 0,
      countsForIncome: false,
      attractiveness: 0,
      requiresTitleIds: [],
      awardedByCards: ['Carry the Day'],
    },
  ],
  offices: [
    { id: 'chamberlain', name: 'Chamberlain', income: 40 },
    { id: 'inspector', name: 'Inspector of Cavalry', income: 60 },
  ],
  campaignSeasons: [
    {
      number: 1,
      roman: 'I',
      name: 'Test Season I',
      inGarrisonRounds: 2,
      onCampaignRounds: 1,
      inGarrisonEventCards: ['I-1', 'I-2'],
      onCampaignEventCards: ['I-A'],
      flags: { noPrisonerExchange: false, spainBattleRounds: false },
    },
    {
      number: 6,
      roman: 'VI',
      name: 'Test Season VI',
      inGarrisonRounds: 4,
      onCampaignRounds: 0,
      inGarrisonEventCards: ['VI-1', 'VI-2', 'VI-3', 'VI-4'],
      onCampaignEventCards: [],
      flags: { noPrisonerExchange: false, spainBattleRounds: false },
    },
    {
      number: 15,
      roman: 'XV',
      name: 'Test Season XV',
      inGarrisonRounds: 1,
      onCampaignRounds: 1,
      inGarrisonEventCards: ['XV-1'],
      onCampaignEventCards: ['XV-A'],
      flags: { noPrisonerExchange: true, spainBattleRounds: false },
    },
  ],
  ladyQualityTable: [
    { range: { min: 1, max: 1 }, charm: -2, influence: -1, money: -2 },
    { range: { min: 2, max: 3 }, charm: -1, influence: 0, money: -1 },
    { range: { min: 4, max: 7 }, charm: 0, influence: 1, money: 0 },
    { range: { min: 8, max: 9 }, charm: 0, influence: 2, money: 1 },
    { range: { min: 10, max: 10 }, charm: 1, influence: 3, money: 2 },
  ],
  ladyTracks: {
    charm: { min: 0, max: 10, defaultValue: 3 },
    influence: { min: 0, max: 10, defaultValue: 2 },
    money: { min: 0, max: 10, defaultValue: 2 },
  },
}

/** A state with `count` Grognards, all Sergent, in I Corps, seated in order. */
export function makeState(
  count = 2,
  overrides: Array<Partial<Grognard>> = [],
): { state: GameState; grognards: Grognard[] } {
  let state = emptyState('game_test', 'Test Game', '2026-01-01T00:00:00.000Z')
  const grognards: Grognard[] = []

  for (let i = 0; i < count; i += 1) {
    const base = createGrognard({
      name: `Grognard ${i + 1}`,
      rank: 'sergent',
      stats: { ...TEST_STATS },
      money: { paris: 100, purse: 50 },
      standingIndex: testData.standing.defaultIndex,
      commandId: 'i-corps',
    })
    const g: Grognard = { ...base, ...overrides[i] }
    grognards.push(g)
    state = {
      ...state,
      grognards: { ...state.grognards, [g.id]: g },
      seatingOrder: [...state.seatingOrder, g.id],
    }
  }
  return { state, grognards }
}

export function withLady(
  state: GameState,
  name: string,
  qualities: { charm: number; influence: number; money: number },
): { state: GameState; ladyId: string } {
  const lady = createLady(name, qualities)
  return {
    state: { ...state, ladies: { ...state.ladies, [lady.id]: lady } },
    ladyId: lady.id,
  }
}
