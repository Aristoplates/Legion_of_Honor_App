/**
 * Guards the shipped data files. These tests do not check game values (those
 * are still to be transcribed) — they check that what is there is well formed,
 * so a typo while filling in a table fails here instead of mid-game.
 */
import { describe, expect, it } from 'vitest'
import { dataGaps, loadGameData } from '../src/data'
import { nextRank, ranksInOrder } from '../src/data/lookups'

describe('shipped game data', () => {
  it('validates against the schema', () => {
    expect(() => loadGameData()).not.toThrow()
  })

  it('has a rank ladder with unique, ascending order', () => {
    const ladder = ranksInOrder(loadGameData())
    expect(ladder.length).toBeGreaterThan(0)
    expect(ladder[0]!.id).toBe('sergent')
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!.order).toBeGreaterThan(ladder[i - 1]!.order)
    }
  })

  it('walks the ladder by next-highest order, tolerating the numbering gaps', () => {
    const data = loadGameData()
    const ladder = ranksInOrder(data)
    // Sous-Lieutenant (order 10) is followed by Lieutenant (order 20), not a
    // fixed +1 — nextRank must look up the next-highest order, not order+1.
    const sousLt = ladder.find((r) => r.id === 'sous-lieutenant')!
    expect(nextRank(data, sousLt)?.id).toBe('lieutenant')
    expect(nextRank(data, ladder.at(-1)!)).toBeUndefined()
  })

  it('applies the transfer test that matches each rank band', () => {
    const data = loadGameData()
    const byId = (id: string) => data.ranks.find((r) => r.id === id)!
    expect(byId('sergent').transfer).toEqual({ kind: 'aboveStandingCheck' })
    expect(byId('major').transfer).toEqual({ kind: 'aboveStandingCheck' })
    expect(byId('colonel').transfer).toEqual({ kind: 'belowNoticeFraction', divisor: 15 })
    expect(byId('general-de-brigade').transfer).toEqual({
      kind: 'belowNoticeFraction',
      divisor: 20,
    })
    expect(byId('general-de-division').transfer).toEqual({
      kind: 'belowNoticeFraction',
      divisor: 25,
    })
    expect(byId('general').transfer).toEqual({ kind: 'forbidden' })
    expect(byId('marechal').transfer).toEqual({ kind: 'forbidden' })
  })

  it('lets only Sergent..Major duel normally (Colonel and up: cuckoldry exception only)', () => {
    const data = loadGameData()
    for (const rank of data.ranks) {
      expect(rank.canDuel).toBe(rank.order < 60)
    }
  })

  it('reserves the Senior Commander slot and the frozen Standing for General and Marechal', () => {
    const data = loadGameData()
    const seniorRanks = data.ranks.filter((r) => r.isSeniorCommanderRank).map((r) => r.id)
    expect(seniorRanks.sort()).toEqual(['general', 'marechal'])
    for (const rank of data.ranks) {
      expect(rank.freezesStanding).toBe(rank.isSeniorCommanderRank)
    }
  })

  it('starts a Grognard in the "+0 (5)" Standing box with (S) = 5', () => {
    const data = loadGameData()
    const box = data.standing.boxes.find((b) => b.index === data.standing.defaultIndex)
    expect(box?.checkValue).toBe(5)
  })

  it('carries the complete Lady Quality Table, covering every 1D10 result', () => {
    const data = loadGameData()
    for (let roll = 1; roll <= 10; roll += 1) {
      const row = data.ladyQualityTable.find((r) => roll >= r.range.min && roll <= r.range.max)
      expect(row, `no Lady Quality row for ${roll}`).toBeDefined()
    }
    const worst = data.ladyQualityTable.find((r) => r.range.min === 1)!
    expect(worst).toMatchObject({ charm: -2, influence: -1, money: -2 })
    const best = data.ladyQualityTable.find((r) => r.range.min === 10)!
    expect(best).toMatchObject({ charm: 1, influence: 3, money: 2 })
  })

  it('excludes the Marechal title from income, per "other than Marechal"', () => {
    const data = loadGameData()
    expect(data.titles.find((t) => t.id === 'marechal')?.countsForIncome).toBe(false)
    expect(data.titles.find((t) => t.id === 'comte')?.countsForIncome).toBe(true)
  })

  it('sets the Court/Propose title bonuses to 5 / 10 / 15', () => {
    const data = loadGameData()
    const bonus = (id: string) => data.titles.find((t) => t.id === id)?.attractiveness
    expect(bonus('comte')).toBe(5)
    expect(bonus('duc')).toBe(10)
    expect(bonus('prince')).toBe(15)
  })

  it('requires Duc before Prince', () => {
    const data = loadGameData()
    expect(data.titles.find((t) => t.id === 'prince')?.requiresTitleIds).toContain('duc')
  })

  it('flags CS XV as having no Prisoner Exchange and CS X/XII as Spain battle rounds', () => {
    const data = loadGameData()
    const cs = (n: number) => data.campaignSeasons.find((c) => c.number === n)!
    expect(cs(15).flags.noPrisonerExchange).toBe(true)
    expect(cs(10).flags.spainBattleRounds).toBe(true)
    expect(cs(12).flags.spainBattleRounds).toBe(true)
    expect(cs(3).flags.spainBattleRounds).toBe(false)
  })

  it('covers all sixteen Campaign Seasons', () => {
    const data = loadGameData()
    expect(data.campaignSeasons.map((cs) => cs.number)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    )
  })

  it('knows CS VI has at least four In Garrison rounds, because of "after InG VI-4"', () => {
    const data = loadGameData()
    const six = data.campaignSeasons.find((cs) => cs.number === 6)!
    expect(six.inGarrisonRounds).toBeGreaterThanOrEqual(4)
  })
})

describe('player-aid transcription (Grognard Sheet, Assignment Sheet, Fate Sheet, Campaign Season Sheet)', () => {
  it('gives ranks a clean income progression, +2 per step, up to Marechal', () => {
    const data = loadGameData()
    const order = [
      'sergent', 'sous-lieutenant', 'lieutenant', 'capitaine', 'chef-de-bataillon',
      'major', 'colonel', 'general-de-brigade', 'general-de-division', 'general', 'marechal',
    ]
    const incomes = order.map((id) => data.ranks.find((r) => r.id === id)!.income)
    expect(incomes).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22])
  })

  it('requires Napoleon’s Notice only from Major up, per the Grognard Sheet', () => {
    const data = loadGameData()
    const n = (id: string) => data.ranks.find((r) => r.id === id)!.requirements.n
    expect(n('chef-de-bataillon')).toBe(0)
    expect(n('major')).toBeGreaterThan(0)
    expect(n('general')).toBe(85)
  })

  it('matches CS III’s round counts against the booklet’s own worked example', () => {
    const data = loadGameData()
    const cs3 = data.campaignSeasons.find((cs) => cs.number === 3)!
    expect(cs3.inGarrisonRounds).toBe(3)
    expect(cs3.onCampaignRounds).toBe(2)
    expect(cs3.inGarrisonEventCards).toEqual(['III-1', 'III-2', 'III-3'])
    expect(cs3.onCampaignEventCards).toEqual(['III-A', 'III-B'])
  })

  it('gives CS XVI a single On Campaign round holding all four Waterloo-sequence cards', () => {
    const data = loadGameData()
    const cs16 = data.campaignSeasons.find((cs) => cs.number === 16)!
    expect(cs16.onCampaignEventCards).toEqual(['XVI-A1', 'XVI-A2', 'XVI-A3', 'XVI-A4'])
  })

  it('resolves every Assignment Sheet roll (1..100) for every table to a known Command', () => {
    const data = loadGameData()
    const commandIds = new Set(data.commands.map((c) => c.id))
    for (const table of data.assignmentTables) {
      for (let roll = 1; roll <= 100; roll += 1) {
        const entry = table.entries.find((e) => roll >= e.range.min && roll <= e.range.max)
        expect(entry, `table "${table.id}" has no entry for roll ${roll}`).toBeDefined()
        expect(commandIds.has(entry!.commandId)).toBe(true)
      }
    }
  })

  it('gives every Campaign Season an assignment table to roll on', () => {
    const data = loadGameData()
    for (const cs of data.campaignSeasons) {
      const id = cs.assignmentTableId ?? data.defaultAssignmentTableId
      expect(id, `CS ${cs.roman} has no assignment table`).toBeDefined()
      expect(data.assignmentTables.some((t) => t.id === id)).toBe(true)
    }
  })

  it('marks the Imperial Guard and the four Spain armies correctly', () => {
    const data = loadGameData()
    const byId = (id: string) => data.commands.find((c) => c.id === id)!
    expect(byId('imperial-guard').isImperialGuard).toBe(true)
    for (const id of ['army-of-andalusia', 'army-of-castille', 'army-of-portugal', 'army-of-catalonia']) {
      expect(byId(id).theater).toBe('spain')
    }
    expect(byId('army-of-the-orient').theater).toBe('orient')
    expect(byId('army-staff').allowsSeniorCommander).toBe(false)
  })

  it('runs the Standing track +5..-4 with matching 1..10 check values, additive not multiplicative', () => {
    const data = loadGameData()
    const boxes = [...data.standing.boxes].sort((a, b) => a.index - b.index)
    expect(boxes.map((b) => b.standingModifier)).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5])
    expect(boxes.map((b) => b.checkValue)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    // "Roll 1D10 on Standing" -> the box index is simply roll-1.
    for (let roll = 1; roll <= 10; roll += 1) {
      const mapped = data.standing.rollToIndex.find((r) => roll >= r.range.min && roll <= r.range.max)
      expect(mapped?.index).toBe(roll - 1)
    }
  })

  it('orders wound levels worst-to-mildest as Killed > Gravely > Severely > Badly', () => {
    const data = loadGameData()
    const severity = (id: string) => data.wounds.levels.find((l) => l.id === id)!.severity
    expect(severity('kia')).toBeGreaterThan(severity('gravely'))
    expect(severity('gravely')).toBeGreaterThan(severity('severely'))
    expect(severity('severely')).toBeGreaterThan(severity('badly'))
    expect(severity('badly')).toBeGreaterThan(severity('flesh-wound'))
  })

  it('recovers Badly Wounded fastest (x8) and Gravely Wounded slowest (x3)', () => {
    const data = loadGameData()
    const mult = (id: string) => data.wounds.levels.find((l) => l.id === id)!.recoveryMultiplier
    expect(mult('gravely')).toBe(3)
    expect(mult('severely')).toBe(5)
    expect(mult('badly')).toBe(8)
  })

  it('covers 1..110 on the Wound Table, the extra range needed for the duel +10 shift', () => {
    const data = loadGameData()
    for (let roll = 1; roll <= 110; roll += 1) {
      const entry = data.wounds.entries.find((e) => roll >= e.range.min && roll <= e.range.max)
      expect(entry, `no Wound Table entry for ${roll}`).toBeDefined()
    }
  })

  it('gives the Legion of Honor a rising glory bonus and income per level', () => {
    const data = loadGameData()
    expect(data.legionOfHonor.map((l) => l.glory)).toEqual([0, 2, 4, 6, 8, 10])
    expect(data.legionOfHonor.map((l) => l.income)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('gives the single Office a M10 income, per both the Grognard Sheet and the Rules Summary', () => {
    const data = loadGameData()
    expect(data.offices).toEqual([{ id: 'office', name: 'Office', income: 10 }])
  })
})

describe('dataGaps', () => {
  it('reports nothing once every tracked table is filled in (player aids are now transcribed)', () => {
    const gaps = dataGaps(loadGameData())
    expect(gaps).toEqual([])
  })

  it('still reports a gap shape (table/what/impact) if a table is emptied out', () => {
    const data = loadGameData()
    const withEmptyWounds = { ...data, wounds: { ...data.wounds, entries: [] } }
    const gaps = dataGaps(withEmptyWounds)
    expect(gaps.length).toBeGreaterThan(0)
    for (const gap of gaps) {
      expect(gap.table).toMatch(/\.json$/)
      expect(gap.what.length).toBeGreaterThan(0)
      expect(gap.impact.length).toBeGreaterThan(0)
    }
    expect(gaps.map((g) => g.what).join(' | ')).toMatch(/Wound Table/)
  })
})
