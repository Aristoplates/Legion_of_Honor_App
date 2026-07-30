import { describe, expect, it } from 'vitest'
import { startingAssignment, startingHealth, startingRankId } from '../src/domain/rules/setup'
import { testData } from './fixtures'

describe('startingRankId', () => {
  it('gives Sergent for 1..5 and Sous-Lieutenant for 6..10', () => {
    for (let roll = 1; roll <= 5; roll += 1) expect(startingRankId(roll)).toBe('sergent')
    for (let roll = 6; roll <= 10; roll += 1) expect(startingRankId(roll)).toBe('sous-lieutenant')
  })
})

describe('startingHealth', () => {
  it('is 100 minus the roll', () => {
    expect(startingHealth(1)).toBe(99)
    expect(startingHealth(10)).toBe(90)
  })
})

describe('startingAssignment', () => {
  it('looks up the Command for a 2D10 roll on the CS I table', () => {
    expect(startingAssignment(testData, 25)).toBe('i-corps')
    expect(startingAssignment(testData, 100)).toBe('staff')
  })
})
