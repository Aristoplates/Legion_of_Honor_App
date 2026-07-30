import { describe, expect, it } from 'vitest'
import {
  applyEvent,
  foldEvents,
  mustGrognard,
  type GameEvent,
  type GameEventBody,
} from '../src/domain/events'
import { createLady } from '../src/domain/factories'
import type { GameState } from '../src/domain/types'
import { makeState, testData } from './fixtures'

let seq = 0
/**
 * Wraps an event body in the journal metadata the reducer ignores.
 * Takes GameEventBody rather than Omit<GameEvent, …>, because Omit over a
 * discriminated union collapses it to the keys all members share.
 */
function ev(body: GameEventBody): GameEvent {
  seq += 1
  return {
    id: `e${seq}`,
    at: '2026-01-01T00:00:00.000Z',
    label: 'test',
    subjects: [],
    ...body,
  }
}

describe('stat changes', () => {
  it('adds deltas and keeps Health inside 0..100', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const after = applyEvent(
      state,
      ev({ type: 'STAT_DELTA', grognardId: g!.id, changes: { h: 50 } }),
    )
    expect(mustGrognard(after, g!.id).stats.h).toBe(100)

    const dead = applyEvent(
      state,
      ev({ type: 'STAT_DELTA', grognardId: g!.id, changes: { h: -200 } }),
    )
    expect(mustGrognard(dead, g!.id).stats.h).toBe(0)
  })

  it('floors Glory at 0 rather than going negative', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const after = applyEvent(
      state,
      ev({ type: 'STAT_DELTA', grognardId: g!.id, changes: { g: -1000 } }),
    )
    expect(mustGrognard(after, g!.id).stats.g).toBe(0)
  })

  it('never lets Money go negative', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const after = applyEvent(
      state,
      ev({ type: 'MONEY_DELTA', grognardId: g!.id, changes: { purse: -9999 } }),
    )
    expect(mustGrognard(after, g!.id).money.purse).toBe(0)
  })

  it('names the Grognard when an event points at a missing one', () => {
    const { state } = makeState(1)
    expect(() =>
      applyEvent(state, ev({ type: 'STAT_DELTA', grognardId: 'nope', changes: { g: 1 } })),
    ).toThrow(/Unknown Grognard "nope"/)
  })
})

describe('standing', () => {
  it('moves along the track within bounds', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const max = testData.standing.boxes.length - 1
    const up = applyEvent(
      state,
      ev({ type: 'STANDING_DELTA', grognardId: g!.id, delta: 99, maxIndex: max }),
    )
    expect(mustGrognard(up, g!.id).standingIndex).toBe(max)

    const down = applyEvent(
      state,
      ev({ type: 'STANDING_DELTA', grognardId: g!.id, delta: -99, maxIndex: max }),
    )
    expect(mustGrognard(down, g!.id).standingIndex).toBe(0)
  })

  it('freezes once the hat counter is placed (General/Marechal)', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const withHat = applyEvent(
      state,
      ev({ type: 'HAT_COUNTER_PLACED', grognardId: g!.id, index: 2 }),
    )
    const nudged = applyEvent(
      withHat,
      ev({ type: 'STANDING_DELTA', grognardId: g!.id, delta: -3, maxIndex: 4 }),
    )
    expect(mustGrognard(nudged, g!.id).standingIndex).toBe(2)

    const forced = applyEvent(nudged, ev({ type: 'STANDING_SET', grognardId: g!.id, index: 0 }))
    expect(mustGrognard(forced, g!.id).standingIndex).toBe(2)
  })
})

describe('ladies', () => {
  function stateWithLady(): { state: GameState; ladyId: string; ids: string[] } {
    const { state, grognards } = makeState(2)
    const lady = createLady('Mme Test', { charm: 4, influence: 3, money: 2 })
    return {
      state: { ...state, ladies: { [lady.id]: lady } },
      ladyId: lady.id,
      ids: grognards.map((g) => g.id),
    }
  }

  it('clears Mistress counters and Ardor on marriage', () => {
    const { state, ladyId, ids } = stateWithLady()
    const [a, b] = ids
    let s = applyEvent(state, ev({ type: 'MISTRESS_TAKEN', ladyId, grognardId: b! }))
    s = applyEvent(s, ev({ type: 'ARDOR_ADDED', ladyId, grognardId: a!, kind: 'propose' }))
    s = applyEvent(s, ev({ type: 'MARRIED', ladyId, grognardId: a! }))

    const lady = s.ladies[ladyId]!
    expect(lady.wifeOf).toBe(a)
    expect(lady.mistressOf).toEqual([])
    expect(lady.ardor).toEqual([])
  })

  it('bars both court and propose after a divorce', () => {
    const { state, ladyId, ids } = stateWithLady()
    const [a] = ids
    let s = applyEvent(state, ev({ type: 'MARRIED', ladyId, grognardId: a! }))
    s = applyEvent(s, ev({ type: 'DIVORCED', ladyId, grognardId: a! }))

    const lady = s.ladies[ladyId]!
    expect(lady.wifeOf).toBeNull()
    expect(lady.barred).toEqual([{ grognardId: a, court: true, propose: true }])
  })

  it('bars only courting when a Mistress is lost for want of support', () => {
    const { state, ladyId, ids } = stateWithLady()
    const [a] = ids
    let s = applyEvent(state, ev({ type: 'MISTRESS_TAKEN', ladyId, grognardId: a! }))
    s = applyEvent(s, ev({ type: 'MISTRESS_LOST', ladyId, grognardId: a!, barCourt: true }))

    const lady = s.ladies[ladyId]!
    expect(lady.mistressOf).toEqual([])
    expect(lady.barred).toEqual([{ grognardId: a, court: true, propose: false }])
  })

  it('tracks Courting and Proposing Ardor separately', () => {
    const { state, ladyId, ids } = stateWithLady()
    const [a] = ids
    let s = applyEvent(state, ev({ type: 'ARDOR_ADDED', ladyId, grognardId: a!, kind: 'court' }))
    s = applyEvent(s, ev({ type: 'ARDOR_ADDED', ladyId, grognardId: a!, kind: 'court' }))
    s = applyEvent(s, ev({ type: 'ARDOR_ADDED', ladyId, grognardId: a!, kind: 'propose' }))

    expect(s.ladies[ladyId]!.ardor).toEqual([{ grognardId: a, courting: 2, proposing: 1 }])
  })

  it('does not add a Grognard to mistressOf twice', () => {
    const { state, ladyId, ids } = stateWithLady()
    const [a] = ids
    let s = applyEvent(state, ev({ type: 'MISTRESS_TAKEN', ladyId, grognardId: a! }))
    s = applyEvent(s, ev({ type: 'MISTRESS_TAKEN', ladyId, grognardId: a! }))
    expect(s.ladies[ladyId]!.mistressOf).toEqual([a])
  })
})

describe('rounds and convalescence', () => {
  it('counts a full round for convalescing Grognards only', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    let s = applyEvent(
      state,
      ev({
        type: 'CONVALESCENCE_SET',
        grognardId: a!.id,
        convalescence: { woundLevelId: 'gravely', fullRounds: 0 },
      }),
    )
    s = applyEvent(s, ev({ type: 'CONVALESCENCE_TICKED' }))
    s = applyEvent(s, ev({ type: 'CONVALESCENCE_TICKED' }))

    expect(mustGrognard(s, a!.id).status.convalescence?.fullRounds).toBe(2)
    expect(mustGrognard(s, b!.id).status.convalescence).toBeNull()
  })

  it('resets card counters and the Zeal skip at the start of a round', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    let s = applyEvent(state, ev({ type: 'CARD_DRAWN', grognardId: g!.id }))
    s = applyEvent(s, ev({ type: 'CARD_DRAWN', grognardId: g!.id }))
    s = applyEvent(s, ev({ type: 'ZEAL_USED', grognardId: g!.id }))
    expect(mustGrognard(s, g!.id).cardsDrawnThisRound).toBe(2)
    expect(mustGrognard(s, g!.id).skipNextCard).toBe(true)

    s = applyEvent(s, ev({ type: 'ROUND_COUNTERS_RESET' }))
    expect(mustGrognard(s, g!.id).cardsDrawnThisRound).toBe(0)
    expect(mustGrognard(s, g!.id).skipNextCard).toBe(false)
  })

  it('counts only non-duel wounds towards the Imperial Guard request', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    let s = applyEvent(state, ev({ type: 'WOUND_RECORDED', grognardId: g!.id, fromDuel: false }))
    s = applyEvent(s, ev({ type: 'WOUND_RECORDED', grognardId: g!.id, fromDuel: true }))
    expect(mustGrognard(s, g!.id).woundsSinceDeath).toBe(1)
  })
})

describe('titles and office', () => {
  it('awards each title at most once', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    let s = applyEvent(state, ev({ type: 'TITLE_AWARDED', grognardId: g!.id, titleId: 'comte' }))
    s = applyEvent(s, ev({ type: 'TITLE_AWARDED', grognardId: g!.id, titleId: 'comte' }))
    expect(mustGrognard(s, g!.id).titleIds).toEqual(['comte'])
  })

  it('drops the office and bars it for life when Corruption is found out', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    let s = applyEvent(state, ev({ type: 'OFFICE_SET', grognardId: g!.id, officeId: 'chamberlain' }))
    s = applyEvent(s, ev({ type: 'OFFICE_BARRED_FOR_LIFE', grognardId: g!.id }))
    expect(mustGrognard(s, g!.id).officeId).toBeNull()
    expect(mustGrognard(s, g!.id).officeBarredForLife).toBe(true)
  })
})

describe('fold', () => {
  it('rebuilding from the log reproduces the state exactly (undo relies on this)', () => {
    const { state, grognards } = makeState(2)
    const [a, b] = grognards
    const log: GameEvent[] = [
      ev({ type: 'STAT_DELTA', grognardId: a!.id, changes: { g: 12, e: 2 } }),
      ev({ type: 'MONEY_DELTA', grognardId: a!.id, changes: { purse: -30 } }),
      ev({ type: 'STANDING_DELTA', grognardId: b!.id, delta: 1, maxIndex: 4 }),
      ev({ type: 'CONVALESCENCE_TICKED' }),
      ev({ type: 'TITLE_AWARDED', grognardId: b!.id, titleId: 'comte' }),
    ]

    // Folding twice must agree — no clocks, no randomness inside the reducer.
    const once = foldEvents(state, log)
    expect(foldEvents(state, log)).toEqual(once)

    // Undo is "drop the last event and re-fold", so that has to differ.
    const undone = foldEvents(state, log.slice(0, -1))
    expect(undone).not.toEqual(once)
    expect(mustGrognard(undone, b!.id).titleIds).toEqual([])
    expect(mustGrognard(once, b!.id).titleIds).toEqual(['comte'])
  })

  it('leaves the input state untouched', () => {
    const { state, grognards } = makeState(1)
    const [g] = grognards
    const before = structuredClone(state)
    applyEvent(state, ev({ type: 'STAT_DELTA', grognardId: g!.id, changes: { g: 5 } }))
    expect(state).toEqual(before)
  })
})
