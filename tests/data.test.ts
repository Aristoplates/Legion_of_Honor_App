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
    // Sous-Lieutenant is order 10 and Major is 50: next must still find Major.
    const sousLt = ladder.find((r) => r.id === 'sous-lieutenant')!
    expect(nextRank(data, sousLt)?.id).toBe('major')
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

  it('lets only Sergent..Colonel duel', () => {
    const data = loadGameData()
    for (const rank of data.ranks) {
      expect(rank.canDuel).toBe(rank.order <= 60)
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

describe('dataGaps', () => {
  it('reports what still has to be transcribed, with the consequence of each gap', () => {
    const gaps = dataGaps(loadGameData())
    expect(gaps.length).toBeGreaterThan(0)
    for (const gap of gaps) {
      expect(gap.table).toMatch(/\.json$/)
      expect(gap.what.length).toBeGreaterThan(0)
      expect(gap.impact.length).toBeGreaterThan(0)
    }
    // The tables known to be missing today.
    const what = gaps.map((g) => g.what).join(' | ')
    expect(what).toMatch(/Wound Table/)
    expect(what).toMatch(/Standing track/)
    expect(what).toMatch(/Offices/)
  })
})
