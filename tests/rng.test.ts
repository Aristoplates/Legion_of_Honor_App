import { describe, expect, it } from 'vitest'
import {
  applyFormulaTo,
  d10,
  d100,
  describeFormula,
  findByRange,
  parseFormula,
  percentOf,
  roll,
  seededRng,
} from '../src/domain/rng'

describe('dice', () => {
  it('rolls 1D10 in 1..10, never 0', () => {
    const rng = seededRng(42)
    for (let i = 0; i < 2000; i += 1) {
      const v = d10(rng)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('reads 2D10 as a percentile with 00 = 100', () => {
    const rng = seededRng(7)
    let sawHundred = false
    for (let i = 0; i < 5000; i += 1) {
      const { value, tens, units } = d100(rng)
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(100)
      if (tens === 0 && units === 0) {
        expect(value).toBe(100)
        sawHundred = true
      } else {
        expect(value).toBe(tens * 10 + units)
      }
    }
    expect(sawHundred).toBe(true)
  })
})

describe('parseFormula', () => {
  it('parses the booklet notation', () => {
    expect(parseFormula('1D10')).toMatchObject({ count: 1, divisor: 1, multiplier: 1 })
    expect(parseFormula('2D10')).toMatchObject({ count: 2, percentile: true })
    expect(parseFormula('1D10÷3▼')).toMatchObject({ divisor: 3, rounding: 'down' })
    expect(parseFormula('1D10÷2▲')).toMatchObject({ divisor: 2, rounding: 'up' })
    expect(parseFormula('1D10x1.5▲')).toMatchObject({ multiplier: 1.5, rounding: 'up' })
  })

  it('accepts ASCII aliases so formulas can be typed without symbols', () => {
    expect(parseFormula('1d10/3v')).toMatchObject({ divisor: 3, rounding: 'down' })
    expect(parseFormula('1d10/2^')).toMatchObject({ divisor: 2, rounding: 'up' })
  })

  it('rejects nonsense loudly', () => {
    expect(() => parseFormula('3d6')).toThrow(/Unsupported/)
    expect(() => parseFormula('1d10÷0')).toThrow(/zero/)
  })

  it('reprints a formula the way the booklet does', () => {
    expect(describeFormula('1d10/3v')).toBe('1D10÷3▼')
    expect(describeFormula('2D10')).toBe('2D10')
    expect(describeFormula('1D10÷2▲')).toBe('1D10÷2▲')
  })
})

describe('roll', () => {
  it('applies divisor and rounding, keeping the raw roll for the journal', () => {
    // Aging: H − 1D10 ÷ 3 ▼
    for (const [raw, expected] of [
      [1, 0],
      [3, 1],
      [5, 1],
      [8, 2],
      [10, 3],
    ] as const) {
      expect(applyFormulaTo('1D10÷3▼', raw).value).toBe(expected)
    }
  })

  it('rounds up when the booklet prints ▲', () => {
    // Experience at setup: 1D10 ÷ 2 ▲
    expect(applyFormulaTo('1D10÷2▲', 1).value).toBe(1)
    expect(applyFormulaTo('1D10÷2▲', 5).value).toBe(3)
    expect(applyFormulaTo('1D10÷2▲', 10).value).toBe(5)
    // Fencing at setup: 1D10 ÷ 3 ▲
    expect(applyFormulaTo('1D10÷3▲', 1).value).toBe(1)
    expect(applyFormulaTo('1D10÷3▲', 10).value).toBe(4)
  })

  it('rejects entered rolls outside the possible range', () => {
    expect(() => applyFormulaTo('1D10', 0)).toThrow(/outside 1\.\.10/)
    expect(() => applyFormulaTo('1D10', 11)).toThrow(/outside 1\.\.10/)
    expect(() => applyFormulaTo('2D10', 101)).toThrow(/outside 1\.\.100/)
    expect(applyFormulaTo('2D10', 100).value).toBe(100)
  })

  it('is reproducible for a given seed', () => {
    const a = roll('2D10', seededRng(99))
    const b = roll('2D10', seededRng(99))
    expect(a.value).toBe(b.value)
    expect(a.dice).toEqual(b.dice)
  })
})

describe('percentOf', () => {
  it('rounds the 10% Paris tax down', () => {
    expect(percentOf(100, 10)).toBe(10)
    expect(percentOf(99, 10)).toBe(9)
    expect(percentOf(5, 10)).toBe(0)
  })
})

describe('findByRange', () => {
  const table = [
    { range: { min: 1, max: 5 }, v: 'low' },
    { range: { min: 6, max: 10 }, v: 'high' },
  ]

  it('finds the entry containing the roll, inclusive at both ends', () => {
    expect(findByRange(table, 1)?.v).toBe('low')
    expect(findByRange(table, 5)?.v).toBe('low')
    expect(findByRange(table, 6)?.v).toBe('high')
    expect(findByRange(table, 10)?.v).toBe('high')
  })

  it('returns undefined outside the table instead of guessing', () => {
    expect(findByRange(table, 11)).toBeUndefined()
  })
})
