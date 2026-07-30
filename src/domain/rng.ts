/**
 * Dice.
 *
 * Two house rules from the booklet drive everything here:
 *   - "When rolling 1D10, 0 = 10"        → 1D10 yields 1..10
 *   - "When rolling 2D10, results go from 1 to 100"  → percentile, 00 = 100
 *
 * The Rng is injected so tests are deterministic, and every roll is returned
 * with the raw dice alongside the final value so the journal can show what
 * actually happened rather than only the outcome.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
}

export const cryptoRng: Rng = {
  next() {
    const buf = new Uint32Array(1)
    globalThis.crypto.getRandomValues(buf)
    return (buf[0] ?? 0) / 2 ** 32
  },
}

/** Deterministic PRNG for tests and for replaying a recorded game. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** One ten-sided die, 1..10. */
export function d10(rng: Rng): number {
  return Math.floor(rng.next() * 10) + 1
}

/**
 * Percentile 2D10: tens die and units die, 1..100 with 00 read as 100.
 * Returns the two dice as well, because the play aids quote results as "01..05".
 */
export function d100(rng: Rng): { value: number; tens: number; units: number } {
  const tens = Math.floor(rng.next() * 10) // 0..9
  const units = Math.floor(rng.next() * 10) // 0..9
  const value = tens * 10 + units
  return { value: value === 0 ? 100 : value, tens, units }
}

export type Rounding = 'down' | 'up'

export interface RollResult {
  /** The formula as given, e.g. "1d10÷3▼". */
  formula: string
  /** The individual dice, in order. */
  dice: number[]
  /** Sum of the dice before divide/multiply — the "raw" roll. */
  raw: number
  /** Final value after divide, multiply and rounding. */
  value: number
  /** Human-readable trace for the journal, e.g. "1D10÷3▼: 8 → 2". */
  text: string
}

interface Formula {
  count: number
  /** 2d10 is the percentile roll, not two independent d10s. */
  percentile: boolean
  divisor: number
  multiplier: number
  rounding: Rounding
}

const FORMULA_CACHE = new Map<string, Formula>()

/**
 * Parses the booklet's notation, so step definitions can be written the way
 * the rules are printed: "1D10", "2D10", "1D10÷3▼", "1D10÷2▲", "1D10x1.5▲".
 * ASCII aliases are accepted too: "/" for ÷, "v" for ▼, "^" for ▲.
 */
export function parseFormula(formula: string): Formula {
  const cached = FORMULA_CACHE.get(formula)
  if (cached) return cached

  const normalised = formula
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[/:]/g, '÷')
    .replace(/[x*×]/g, '×')
    .replace(/v$/, '▼')
    .replace(/\^$/, '▲')

  const match = /^(\d*)d10(?:÷([\d.]+))?(?:×([\d.]+))?([▼▲])?$/.exec(normalised)
  if (!match) throw new Error(`Unsupported dice formula: "${formula}"`)

  const [, countRaw, divisorRaw, multiplierRaw, roundingRaw] = match
  const count = countRaw ? Number(countRaw) : 1
  if (count < 1) throw new Error(`Dice count must be at least 1: "${formula}"`)

  const divisor = divisorRaw ? Number(divisorRaw) : 1
  if (divisor === 0) throw new Error(`Division by zero in formula: "${formula}"`)

  const parsed: Formula = {
    count,
    percentile: count === 2,
    divisor,
    multiplier: multiplierRaw ? Number(multiplierRaw) : 1,
    // The booklet always prints the rounding it wants; default to down when a
    // formula divides without saying, since that is the commoner case.
    rounding: roundingRaw === '▲' ? 'up' : 'down',
  }
  FORMULA_CACHE.set(formula, parsed)
  return parsed
}

export function applyRounding(value: number, rounding: Rounding): number {
  return rounding === 'up' ? Math.ceil(value) : Math.floor(value)
}

/** Rolls a booklet formula. See {@link parseFormula} for the accepted notation. */
export function roll(formula: string, rng: Rng): RollResult {
  const f = parseFormula(formula)

  let dice: number[]
  let raw: number
  if (f.percentile) {
    const p = d100(rng)
    dice = [p.tens, p.units]
    raw = p.value
  } else {
    dice = Array.from({ length: f.count }, () => d10(rng))
    raw = dice.reduce((sum, d) => sum + d, 0)
  }

  const value = applyRounding((raw / f.divisor) * f.multiplier, f.rounding)
  return { formula, dice, raw, value, text: `${describeFormula(formula)}: ${raw} → ${value}` }
}

/**
 * Re-rolls the arithmetic of a formula against a value the player rolled with
 * physical dice, so the app never forces its own randomness on the table.
 */
export function applyFormulaTo(formula: string, rawRoll: number): RollResult {
  const f = parseFormula(formula)
  const max = f.percentile ? 100 : f.count * 10
  if (!Number.isInteger(rawRoll) || rawRoll < 1 || rawRoll > max) {
    throw new Error(`Roll ${rawRoll} is outside 1..${max} for "${formula}"`)
  }
  const value = applyRounding((rawRoll / f.divisor) * f.multiplier, f.rounding)
  return {
    formula,
    dice: [],
    raw: rawRoll,
    value,
    text: `${describeFormula(formula)}: ${rawRoll} → ${value} (entered)`,
  }
}

/** The formula formatted the way the booklet prints it, for prompts and the log. */
export function describeFormula(formula: string): string {
  const f = parseFormula(formula)
  let out = `${f.count}D10`
  if (f.divisor !== 1) out += `÷${f.divisor}`
  if (f.multiplier !== 1) out += `x${f.multiplier}`
  if (f.divisor !== 1 || f.multiplier !== 1) out += f.rounding === 'up' ? '▲' : '▼'
  return out
}

/**
 * Percentage of a value with explicit rounding, for the rules that are written
 * as percentages rather than dice: Tax ("M Paris–10% ▼") and Plunder.
 */
export function percentOf(value: number, percent: number, rounding: Rounding = 'down'): number {
  return applyRounding((value * percent) / 100, rounding)
}

/** Looks up a value in a table of 1..N ranges, e.g. the Wound or Standing tables. */
export function findByRange<T extends { range: { min: number; max: number } }>(
  entries: readonly T[],
  value: number,
): T | undefined {
  return entries.find((e) => value >= e.range.min && value <= e.range.max)
}
