import { describe, expect, it } from 'vitest'
import {
  attractiveness,
  canAttemptWithLady,
  cuckoldedBy,
  determineSeniorGrognard,
  highestEligibleRank,
  incomeFor,
  isAbsent,
  rankEligibility,
  supportCosts,
  turnOrderFromSenior,
  usableInfluence,
} from '../src/domain/selectors'
import { mustRank } from '../src/data/lookups'
import type { GameState, Grognard } from '../src/domain/types'
import { makeState, testData, withLady } from './fixtures'

function set(state: GameState, g: Grognard, patch: Partial<Grognard>): GameState {
  return { ...state, grognards: { ...state.grognards, [g.id]: { ...g, ...patch } } }
}

describe('isAbsent', () => {
  it('always counts Dead and Retired', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const dead = set(state, g!, { status: { ...g!.status, dead: true } })
    expect(isAbsent(dead, dead.grognards[g!.id]!)).toBe(true)

    const retired = set(state, g!, { status: { ...g!.status, retired: true } })
    expect(isAbsent(retired, retired.grognards[g!.id]!)).toBe(true)
  })

  it('honours the configurable reading for Prisoner, Furlough and Convalescent', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const furloughed = set(state, g!, { status: { ...g!.status, furlough: true } })
    expect(isAbsent(furloughed, furloughed.grognards[g!.id]!)).toBe(true)

    const relaxed: GameState = {
      ...furloughed,
      absenceRules: { prisoner: true, furlough: false, convalescent: true },
    }
    expect(isAbsent(relaxed, relaxed.grognards[g!.id]!)).toBe(false)
  })
})

describe('determineSeniorGrognard', () => {
  it('picks the highest rank', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    const s = set(state, b!, { rank: 'colonel' })
    expect(determineSeniorGrognard(s, testData).grognardId).toBe(b!.id)
    expect(determineSeniorGrognard(s, testData).grognardId).not.toBe(a!.id)
  })

  it('breaks a rank tie on N first, exactly as printed', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    // b has less N but far more G - N must still decide it.
    let s = set(state, a!, { stats: { ...a!.stats, n: 40, g: 0 } })
    s = set(s, s.grognards[b!.id]!, { stats: { ...b!.stats, n: 39, g: 999 } })
    expect(determineSeniorGrognard(s, testData).grognardId).toBe(a!.id)
  })

  it('falls through N, G, E to Money', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    const same = { n: 20, g: 20, e: 20, h: 50, c: 5, f: 5 }
    let s = set(state, a!, { stats: same, money: { paris: 10, purse: 10 } })
    s = set(s, s.grognards[b!.id]!, { stats: same, money: { paris: 500, purse: 0 } })
    expect(determineSeniorGrognard(s, testData).grognardId).toBe(b!.id)
  })

  it('reports the still-tied candidates so the table can roll for it', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    const same = { n: 20, g: 20, e: 20, h: 50, c: 5, f: 5 }
    let s = set(state, a!, { stats: same, money: { paris: 10, purse: 10 } })
    s = set(s, s.grognards[b!.id]!, { stats: same, money: { paris: 10, purse: 10 } })

    const result = determineSeniorGrognard(s, testData)
    expect(result.grognardId).toBeNull()
    expect(result.tiedIds.sort()).toEqual([a!.id, b!.id].sort())
  })

  it('ignores absent Grognards even when they outrank everyone', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    const s = set(state, a!, { rank: 'marechal', status: { ...a!.status, prisoner: true } })
    expect(determineSeniorGrognard(s, testData).grognardId).toBe(b!.id)
  })

  it('yields nobody when every Grognard is absent', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const s = set(state, g!, { status: { ...g!.status, dead: true } })
    expect(determineSeniorGrognard(s, testData).grognardId).toBeNull()
  })
})

describe('turnOrderFromSenior', () => {
  it('starts at the Senior Grognard and continues clockwise', () => {
    const { state, grognards } = makeState(4)
    const ids = grognards.map((g) => g.id)
    const s: GameState = { ...state, seniorGrognardId: ids[2]! }
    expect(turnOrderFromSenior(s).map((g) => g.id)).toEqual([ids[2], ids[3], ids[0], ids[1]])
  })
})

describe('incomeFor', () => {
  it('sums rank, highest title, office and LoH', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    let s = set(state, g!, {
      rank: 'colonel',
      titleIds: ['comte', 'duc'],
      officeId: 'chamberlain',
      lohLevel: 2,
    })
    s = { ...s, lohBenefitsActive: true }

    const income = incomeFor(s, testData, s.grognards[g!.id]!)
    expect(income.rank).toBe(61)
    // Highest title only: Duc 100, not Comte 50 + Duc 100.
    expect(income.title).toBe(100)
    expect(income.office).toBe(40)
    expect(income.loh).toBe(50)
    expect(income.total).toBe(251)
    expect(income.account).toBe('purse')
  })

  it('withholds Legion of Honor income until the markers are revealed after InG VI-4', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const s = set(state, g!, { lohLevel: 3 })
    expect(incomeFor(s, testData, s.grognards[g!.id]!).loh).toBe(0)

    const revealed = { ...s, lohBenefitsActive: true }
    expect(incomeFor(revealed, testData, revealed.grognards[g!.id]!).loh).toBe(100)
  })

  it('multiplies rank income by 1.5 rounded up in the Imperial Guard', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    // Colonel income 61 -> 91.5 -> 92 (round up).
    const s = set(state, g!, { rank: 'colonel', commandId: 'imperial-guard' })
    expect(incomeFor(s, testData, s.grognards[g!.id]!).rank).toBe(92)
  })

  it('halves rank and office income while absent', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const s = set(state, g!, {
      rank: 'colonel',
      officeId: 'inspector',
      status: { ...g!.status, furlough: true },
    })
    const income = incomeFor(s, testData, s.grognards[g!.id]!)
    expect(income.rank).toBe(30) // 61 x 0.5 -> 30 (down)
    expect(income.office).toBe(30) // 60 x 0.5
  })

  it('pays a Prisoner into Paris instead of his Purse', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const s = set(state, g!, { status: { ...g!.status, prisoner: true } })
    expect(incomeFor(s, testData, s.grognards[g!.id]!).account).toBe('paris')
  })

  it("pays the Wife's income as her Money x3 into Paris", () => {
    const base = makeState(1)
    const [g] = base.grognards
    const { state, ladyId } = withLady(base.state, 'Mme A', { charm: 4, influence: 3, money: 5 })
    const married: GameState = {
      ...state,
      ladies: { ...state.ladies, [ladyId]: { ...state.ladies[ladyId]!, wifeOf: g!.id } },
    }
    expect(incomeFor(married, testData, married.grognards[g!.id]!).wife).toBe(15)
  })
})

describe('supportCosts', () => {
  it('charges the Wife her full (C)+(I)+(M) and each Mistress half, rounded down', () => {
    const base = makeState(1)
    const [g] = base.grognards
    const withWife = withLady(base.state, 'Wife', { charm: 4, influence: 3, money: 2 })
    const withMistress = withLady(withWife.state, 'Mistress', { charm: 3, influence: 2, money: 2 })

    const s: GameState = {
      ...withMistress.state,
      ladies: {
        ...withMistress.state.ladies,
        [withWife.ladyId]: { ...withMistress.state.ladies[withWife.ladyId]!, wifeOf: g!.id },
        [withMistress.ladyId]: {
          ...withMistress.state.ladies[withMistress.ladyId]!,
          mistressOf: [g!.id],
        },
      },
    }

    const costs = supportCosts(s, s.grognards[g!.id]!)
    expect(costs.wife).toBe(9)
    // (3+2+2) = 7, halved and rounded down = 3
    expect(costs.mistresses).toEqual([{ ladyId: withMistress.ladyId, name: 'Mistress', cost: 3 }])
  })
})

describe('cuckoldry and influence', () => {
  it('names the Grognards whose Mistress is his Wife', () => {
    const base = makeState(2)
    const [a, b] = base.grognards
    const { state, ladyId } = withLady(base.state, 'Mme B', { charm: 5, influence: 4, money: 3 })
    const s: GameState = {
      ...state,
      ladies: {
        [ladyId]: { ...state.ladies[ladyId]!, wifeOf: a!.id, mistressOf: [b!.id] },
      },
    }
    expect(cuckoldedBy(s, s.grognards[a!.id]!)).toEqual([b!.id])
    expect(cuckoldedBy(s, s.grognards[b!.id]!)).toEqual([])
  })

  it("withholds the Wife's Influence after an Indiscretion but keeps the Mistress's", () => {
    const base = makeState(1)
    const [g] = base.grognards
    const wife = withLady(base.state, 'Wife', { charm: 4, influence: 3, money: 2 })
    const mistress = withLady(wife.state, 'Mistress', { charm: 3, influence: 2, money: 1 })
    let s: GameState = {
      ...mistress.state,
      ladies: {
        ...mistress.state.ladies,
        [wife.ladyId]: { ...mistress.state.ladies[wife.ladyId]!, wifeOf: g!.id },
        [mistress.ladyId]: { ...mistress.state.ladies[mistress.ladyId]!, mistressOf: [g!.id] },
      },
    }
    expect(usableInfluence(s, s.grognards[g!.id]!)).toBe(5)

    s = set(s, s.grognards[g!.id]!, { indiscretionThisCS: true })
    expect(usableInfluence(s, s.grognards[g!.id]!)).toBe(2)
  })
})

describe('rank eligibility', () => {
  it('ignores the N requirement before Campaign Season VI', () => {
    const { grognards } = makeState(1)
    const [g] = grognards
    const poorNotice = { ...g!, stats: { n: 0, g: 30, e: 10, h: 50, c: 5, f: 5 } }

    const sousLt = mustRank(testData, 'sous-lieutenant')
    expect(rankEligibility(poorNotice, sousLt, 5).eligible).toBe(true)
    expect(rankEligibility(poorNotice, sousLt, 6).eligible).toBe(false)
  })

  it('substitutes excess N for G and excess G/2 for E', () => {
    const { grognards } = makeState(1)
    const [g] = grognards
    // Colonel needs N40 G100 E40. N 60 gives 20 excess N, raising G 80 to 100.
    const candidate = { ...g!, stats: { n: 60, g: 80, e: 40, h: 50, c: 5, f: 5 } }
    const colonel = mustRank(testData, 'colonel')
    expect(rankEligibility(candidate, colonel, 6).eligible).toBe(true)

    // Same G shortfall but no spare N: not eligible.
    const short = { ...g!, stats: { n: 40, g: 80, e: 40, h: 50, c: 5, f: 5 } }
    const result = rankEligibility(short, colonel, 6)
    expect(result.eligible).toBe(false)
    expect(result.shortfall.g).toBe(20)
  })

  it('chains the substitution: spare N raises G, whose surplus raises E', () => {
    const { grognards } = makeState(1)
    const [g] = grognards
    // Colonel N40 G100 E40. N 80 leaves 40 spare, so G becomes 140; the 40
    // surplus over G100 gives E +20, taking E from 20 to the required 40.
    const candidate = { ...g!, stats: { n: 80, g: 100, e: 20, h: 50, c: 5, f: 5 } }
    const colonel = mustRank(testData, 'colonel')
    expect(rankEligibility(candidate, colonel, 6).eligible).toBe(true)
  })

  it('finds the highest rank the stats allow and never demotes', () => {
    const { grognards } = makeState(1)
    const [g] = grognards
    const strong = {
      ...g!,
      rank: 'sergent',
      stats: { n: 60, g: 200, e: 80, h: 50, c: 5, f: 5 },
    }
    expect(highestEligibleRank(testData, strong, 6).id).toBe('general')

    const weakButSenior = { ...g!, rank: 'colonel', stats: { n: 0, g: 0, e: 0, h: 1, c: 1, f: 1 } }
    expect(highestEligibleRank(testData, weakButSenior, 6).id).toBe('colonel')
  })
})

describe('attractiveness', () => {
  it('sums Charm, Money/25, rank steps, Office, highest Title and Ardor', () => {
    const base = makeState(1)
    const [g] = base.grognards
    const { state, ladyId } = withLady(base.state, 'Mme C', { charm: 4, influence: 3, money: 2 })

    let s = set(state, g!, {
      rank: 'colonel', // 2 steps above Sergent
      stats: { ...g!.stats, c: 6 },
      money: { paris: 60, purse: 20 }, // 80 / 25 rounded down = 3
      officeId: 'chamberlain', // +5
      titleIds: ['comte', 'duc'], // highest only: +10
    })
    s = {
      ...s,
      ladies: {
        [ladyId]: {
          ...s.ladies[ladyId]!,
          ardor: [{ grognardId: g!.id, courting: 2, proposing: 0 }],
        },
      },
    }

    const a = attractiveness(testData, s.grognards[g!.id]!, s.ladies[ladyId]!, 'court')
    expect(a).toMatchObject({ charm: 6, money: 3, rank: 2, office: 5, title: 10, ardor: 2 })
    expect(a.total).toBe(28)
    expect(a.ladyTotal).toBe(9)
    expect(a.probability).toBe(19)
  })

  it('uses Courting Ardor for courting and Proposing Ardor for proposing', () => {
    const base = makeState(1)
    const [g] = base.grognards
    const { state, ladyId } = withLady(base.state, 'Mme D', { charm: 1, influence: 1, money: 1 })
    const s: GameState = {
      ...state,
      ladies: {
        [ladyId]: {
          ...state.ladies[ladyId]!,
          ardor: [{ grognardId: g!.id, courting: 4, proposing: 1 }],
        },
      },
    }
    const lady = s.ladies[ladyId]!
    expect(attractiveness(testData, s.grognards[g!.id]!, lady, 'court').ardor).toBe(4)
    expect(attractiveness(testData, s.grognards[g!.id]!, lady, 'propose').ardor).toBe(1)
  })
})

describe('canAttemptWithLady', () => {
  it('stops a third Mistress and a second Wife', () => {
    const base = makeState(1)
    const [g] = base.grognards
    const m1 = withLady(base.state, 'M1', { charm: 1, influence: 1, money: 1 })
    const m2 = withLady(m1.state, 'M2', { charm: 1, influence: 1, money: 1 })
    const m3 = withLady(m2.state, 'M3', { charm: 1, influence: 1, money: 1 })

    const s: GameState = {
      ...m3.state,
      ladies: {
        ...m3.state.ladies,
        [m1.ladyId]: { ...m3.state.ladies[m1.ladyId]!, mistressOf: [g!.id] },
        [m2.ladyId]: { ...m3.state.ladies[m2.ladyId]!, mistressOf: [g!.id] },
      },
    }
    const third = canAttemptWithLady(s, s.grognards[g!.id]!, s.ladies[m3.ladyId]!, 'court')
    expect(third).toEqual({ allowed: false, reason: 'Already has 2 Mistresses' })
  })

  it('respects the never-again bar set by a divorce', () => {
    const base = makeState(1)
    const [g] = base.grognards
    const { state, ladyId } = withLady(base.state, 'Ex-Wife', { charm: 1, influence: 1, money: 1 })
    const s: GameState = {
      ...state,
      ladies: {
        [ladyId]: {
          ...state.ladies[ladyId]!,
          barred: [{ grognardId: g!.id, court: true, propose: true }],
        },
      },
    }
    expect(canAttemptWithLady(s, s.grognards[g!.id]!, s.ladies[ladyId]!, 'court').allowed).toBe(
      false,
    )
    expect(canAttemptWithLady(s, s.grognards[g!.id]!, s.ladies[ladyId]!, 'propose').allowed).toBe(
      false,
    )
  })
})
